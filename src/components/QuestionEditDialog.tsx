import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Question } from "@/types/api";

interface Props {
  question: Question;
  disabled?: boolean;
  onSave: (input: {
    text: string;
    options: string[];
    correctOption: "A" | "B" | "C" | "D";
    conceptTested: string;
    commonMistake: string;
    recommendedRemedialAction: string;
    learningOutcome: string;
    bloomsTaxonomyLevel: string;
    sourceReference?: string | null;
    examRelevance: Partial<Record<"JEE_MAIN" | "NEET" | "KCET" | "CBSE", string>>;
  }) => Promise<void>;
}

function emptyExamRelevance(value: string | undefined) {
  return value ?? "";
}

export function QuestionEditDialog({ question, disabled, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    text: question.text,
    options: [...question.options],
    correctOption: question.correctOption,
    conceptTested: question.conceptTested,
    commonMistake: question.commonMistake,
    recommendedRemedialAction: question.recommendedRemedialAction,
    learningOutcome: question.learningOutcome,
    bloomsTaxonomyLevel: question.bloomsTaxonomyLevel,
    sourceReference: question.sourceReference ?? "",
    examRelevance: {
      JEE_MAIN: emptyExamRelevance(question.examRelevance.JEE_MAIN),
      NEET: emptyExamRelevance(question.examRelevance.NEET),
      KCET: emptyExamRelevance(question.examRelevance.KCET),
      CBSE: emptyExamRelevance(question.examRelevance.CBSE),
    },
  });

  useEffect(() => {
    if (!open) {
      setDraft({
        text: question.text,
        options: [...question.options],
        correctOption: question.correctOption,
        conceptTested: question.conceptTested,
        commonMistake: question.commonMistake,
        recommendedRemedialAction: question.recommendedRemedialAction,
        learningOutcome: question.learningOutcome,
        bloomsTaxonomyLevel: question.bloomsTaxonomyLevel,
        sourceReference: question.sourceReference ?? "",
        examRelevance: {
          JEE_MAIN: emptyExamRelevance(question.examRelevance.JEE_MAIN),
          NEET: emptyExamRelevance(question.examRelevance.NEET),
          KCET: emptyExamRelevance(question.examRelevance.KCET),
          CBSE: emptyExamRelevance(question.examRelevance.CBSE),
        },
      });
    }
  }, [open, question]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        text: draft.text,
        options: draft.options,
        correctOption: draft.correctOption,
        conceptTested: draft.conceptTested,
        commonMistake: draft.commonMistake,
        recommendedRemedialAction: draft.recommendedRemedialAction,
        learningOutcome: draft.learningOutcome,
        bloomsTaxonomyLevel: draft.bloomsTaxonomyLevel,
        sourceReference: draft.sourceReference.trim() || null,
        examRelevance: draft.examRelevance,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Pencil className="size-4" />
          Edit Question
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Question Text</Label>
            <Textarea value={draft.text} onChange={(event) => setDraft((state) => ({ ...state, text: event.target.value }))} rows={4} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {draft.options.map((option, index) => (
              <div key={index} className="space-y-1.5">
                <Label>{`Option ${String.fromCharCode(65 + index)}`}</Label>
                <Input
                  value={option}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      options: state.options.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Correct Option</Label>
            <div className="flex flex-wrap gap-2">
              {(["A", "B", "C", "D"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={draft.correctOption === option ? "default" : "outline"}
                  onClick={() => setDraft((state) => ({ ...state, correctOption: option }))}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Concept Tested</Label>
              <Input value={draft.conceptTested} onChange={(event) => setDraft((state) => ({ ...state, conceptTested: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bloom&apos;s Taxonomy Level</Label>
              <Input value={draft.bloomsTaxonomyLevel} onChange={(event) => setDraft((state) => ({ ...state, bloomsTaxonomyLevel: event.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Common Mistake</Label>
            <Textarea value={draft.commonMistake} onChange={(event) => setDraft((state) => ({ ...state, commonMistake: event.target.value }))} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Recommended Remedial Action</Label>
            <Textarea value={draft.recommendedRemedialAction} onChange={(event) => setDraft((state) => ({ ...state, recommendedRemedialAction: event.target.value }))} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Learning Outcome</Label>
            <Textarea value={draft.learningOutcome} onChange={(event) => setDraft((state) => ({ ...state, learningOutcome: event.target.value }))} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label>Source Reference</Label>
            <Input value={draft.sourceReference} onChange={(event) => setDraft((state) => ({ ...state, sourceReference: event.target.value }))} placeholder="Optional source or note" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["JEE_MAIN", "NEET", "KCET", "CBSE"] as const).map((examKey) => (
              <div key={examKey} className="space-y-1.5">
                <Label>{examKey.replace("_", " ")}</Label>
                <Input
                  value={draft.examRelevance[examKey]}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      examRelevance: {
                        ...state.examRelevance,
                        [examKey]: event.target.value,
                      },
                    }))
                  }
                  placeholder="High / Medium / Low / N/A"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
