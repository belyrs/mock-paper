import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  name: string;
  onSave: (name: string) => void | Promise<void>;
  className?: string;
  /** Hide the name text and show only the edit action (for compact list rows). */
  nameHidden?: boolean;
}

export function PaperNameEditor({ name, onSave, className, nameHidden }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim() || name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div
        className={`flex items-center gap-2 ${
          nameHidden ? "rounded-lg border border-border bg-card p-1.5 shadow-md" : ""
        } ${className ?? ""}`}
      >
        <Input
          autoFocus
          value={draft}
          aria-label="Question paper name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-9 max-w-sm"
        />
        <Button
          size="icon"
          variant="default"
          className="size-9"
          onClick={() => void save()}
          aria-label="Save name"
          disabled={saving}
        >
          <Check className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9"
          onClick={() => setEditing(false)}
          aria-label="Cancel rename"
          disabled={saving}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {!nameHidden && <span className="min-w-0 truncate font-semibold">{name}</span>}
      <Button
        size="icon"
        variant="ghost"
        className="size-8 shrink-0"
        onClick={() => setEditing(true)}
        aria-label="Edit paper name"
        disabled={saving}
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );
}
