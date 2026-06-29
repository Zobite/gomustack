import { Modal, message } from "antd";
import { AlertTriangle, Trash2 } from "lucide-react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";

const { confirm } = Modal;

interface PurgeButtonProps {
  selectedIds: string[];
  onPurged: (purgedIds: string[]) => void;
}

/**
 * Self-contained "Purge" button + confirm dialog.
 * Only visible when selectedIds.length > 0.
 * Handles the delete API calls and notifies parent via onPurged.
 */
export default function PurgeButton({ selectedIds, onPurged }: PurgeButtonProps) {
  if (selectedIds.length === 0) return null;

  const handlePurge = () => {
    confirm({
      title: <span className="font-mono text-[14px]">Purge Records</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `${selectedIds.length} variable(s) will be permanently deleted. This action is irreversible.`,
      okText: "Execute Purge",
      okType: "danger",
      async onOk() {
        try {
          await Promise.all(selectedIds.map((id) => client.kvStore.delete(id)));
          onPurged(selectedIds);
          message.success(`${selectedIds.length} variable(s) purged`);
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  return (
    <button
      onClick={handlePurge}
      className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-transparent border border-hairline-strong font-medium text-[13px] cursor-pointer transition-colors hover:border-ink"
      style={{ color: "var(--color-error)" }}
    >
      <Trash2 size={14} />
      Purge ({selectedIds.length})
    </button>
  );
}
