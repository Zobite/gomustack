import { DiffEditor } from "@monaco-editor/react";
import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { MonacoErrorBoundary } from "./MonacoErrorBoundary";

type DiffEditorProps = ComponentProps<typeof DiffEditor>;
type DiffEditorInstance = Parameters<NonNullable<DiffEditorProps["onMount"]>>[0];

/**
 * A wrapper around Monaco's DiffEditor that:
 * 1. Wraps it in a MonacoErrorBoundary to prevent React tree crashes
 * 2. Captures the editor ref via onMount for manual disposal
 * 3. Explicitly disposes the editor on unmount so Monaco's DiffEditorWidget
 *    can cleanly detach its models before React removes the DOM
 *
 * This fixes the "TextModel got disposed before DiffEditorWidget model got reset"
 * error that occurs when React unmounts the DiffEditor (e.g. Accept/Reject AI changes).
 *
 * The root cause: when `hasPending` flips to false (because `value === pendingCode`
 * after setCode), React unmounts the DiffEditor synchronously. Monaco's internal
 * TextModel.dispose() fires during DOM teardown, but the DiffEditorWidget hasn't
 * reset its model references yet. By calling editor.dispose() in useEffect cleanup
 * (which runs before DOM removal), we give Monaco the chance to do an orderly shutdown.
 */
export function SafeDiffEditor(props: DiffEditorProps) {
  const editorRef = useRef<DiffEditorInstance | null>(null);
  const modelsRef = useRef<{ original: any; modified: any } | null>(null);

  const handleMount = useCallback(
    (...args: Parameters<NonNullable<DiffEditorProps["onMount"]>>) => {
      const editor = args[0];
      editorRef.current = editor;

      const model = editor.getModel();
      if (model) {
        modelsRef.current = {
          original: model.original,
          modified: model.modified,
        };
      }

      props.onMount?.(...args);
    },
    [props.onMount],
  );

  // Keep the modelsRef in sync with the current models in case they change
  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        modelsRef.current = {
          original: model.original,
          modified: model.modified,
        };
      }
    }
  });

  // Dispose the models AFTER the DiffEditor widget has already been disposed.
  // Because we pass keepCurrentOriginalModel={true} and keepCurrentModifiedModel={true},
  // the child component's unmount cleanup only disposes the editor widget itself,
  // leaving the models intact. Then, this parent effect runs (which runs AFTER
  // the child's cleanup) and safely disposes the models.
  useEffect(() => {
    return () => {
      // 1. Reset the models on the DiffEditor widget to null to cleanly break references
      if (editorRef.current) {
        try {
          editorRef.current.setModel({
            original: null as any,
            modified: null as any,
          });
        } catch {
          // Swallow any errors
        }
      }

      // 2. Dispose the models
      if (modelsRef.current) {
        try {
          const { original, modified } = modelsRef.current;
          original?.dispose();
          modified?.dispose();
        } catch {
          // Swallow any errors
        }
        modelsRef.current = null;
        editorRef.current = null;
      }
    };
  }, []);

  return (
    <MonacoErrorBoundary>
      <DiffEditor {...props} onMount={handleMount} keepCurrentOriginalModel={true} keepCurrentModifiedModel={true} />
    </MonacoErrorBoundary>
  );
}
