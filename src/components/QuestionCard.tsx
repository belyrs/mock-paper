import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionEditDialog } from "@/components/QuestionEditDialog";
import { LETTERS, type GeneratedQuestion } from "@/lib/mock-generator";
import { cn } from "@/lib/utils";
import type { QuestionUpdateInput } from "@/types/api";

interface Props {
  index: number;
  question: GeneratedQuestion;
  loading: boolean;
  onRegenerate: () => void;
  onEdit: (input: QuestionUpdateInput) => Promise<void>;
}

export function QuestionCard({ index, question, loading, onRegenerate, onEdit }: Props) {
  return (
    <article className="card-surface p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <span className="bg-brand-gradient text-primary-foreground flex size-7 items-center justify-center rounded-lg text-xs font-bold">
              {index + 1}
            </span>
            Question {index + 1}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{question.subject}</Badge>
            <Badge variant="outline">{question.chapter}</Badge>
            <Badge variant="outline">{question.subTopic}</Badge>
            <Badge variant="gold">{question.difficulty}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuestionEditDialog question={question} disabled={loading} onSave={onEdit} />
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {loading ? "Regenerating..." : "Regenerate Question"}
          </Button>
        </div>
      </div>

      <div className={cn("mt-4 transition-opacity", loading && "opacity-40")}>
        <p className="text-[15px] leading-relaxed text-foreground">{question.text}</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {question.options.map((opt, i) => (
            <li
              key={i}
              className="flex gap-2.5 rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm transition-colors hover:border-primary/30"
            >
              <span className="font-semibold text-primary">{LETTERS[i]}.</span>
              <span className="text-foreground">{opt}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
