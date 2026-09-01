import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { downloadPaper, type ExportFormat } from "@/lib/export-paper";
import type { GeneratedQuestion } from "@/lib/mock-generator";
import type { ClassLevel, ExamId } from "@/types/api";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF (.pdf)" },
  { value: "docx", label: "Word (.docx)" },
];

export function DownloadDialog({
  title,
  questions,
  exam,
  classLevel,
}: {
  title: string;
  questions: GeneratedQuestion[];
  exam?: ExamId | null;
  classLevel?: ClassLevel | null;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const metadata = { title, exam, classLevel };
      await downloadPaper(metadata, questions, format, "questions");
      await downloadPaper(metadata, questions, format, "answers");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="size-4" /> Download
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download paper</DialogTitle>
          <DialogDescription>
            The question paper and the answer key are saved as two separate
            files.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="text-sm font-semibold">Format</Label>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            className="mt-3 gap-2"
          >
            {FORMATS.map((f) => (
              <Label
                key={f.value}
                htmlFor={`format-${f.value}`}
                data-selected={format === f.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm font-medium transition-colors hover:border-primary/30 data-[selected=true]:border-primary/40 data-[selected=true]:bg-accent"
              >
                <RadioGroupItem value={f.value} id={`format-${f.value}`} />
                {f.label}
              </Label>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="gap-2"
            onClick={() => void handleDownload()}
            disabled={downloading}
          >
            <Download className="size-4" />{" "}
            {downloading ? "Preparing..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
