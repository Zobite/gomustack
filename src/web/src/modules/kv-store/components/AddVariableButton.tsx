import { message } from "antd";
import { Plus } from "lucide-react";
import { useState } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { CreateVariableInput } from "src/lib/types";
import CreateVariableModal from "./CreateVariableModal";

interface AddVariableButtonProps {
  onCreated: () => void;
}

/**
 * Self-contained "Add Variable" button + modal.
 * Owns its own open/close state and create logic.
 */
export default function AddVariableButton({ onCreated }: AddVariableButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (values: { key: string; value: string; ttl?: number }) => {
    setLoading(true);
    try {
      const input: CreateVariableInput = {
        key: values.key,
        value: values.value,
        type: "string",
        ttl: values.ttl,
      };
      await client.kvStore.create(input);
      setOpen(false);
      onCreated();
      message.success("Variable registered");
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to register variable");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-primary-active transition-colors cursor-pointer border-none"
        onClick={() => setOpen(true)}
      >
        <Plus size={16} />
        Add Variable
      </button>

      <CreateVariableModal open={open} loading={loading} onClose={() => setOpen(false)} onSubmit={handleCreate} />
    </>
  );
}
