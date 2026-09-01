import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface GenerationProgressCardProps {
  title: string;
  description: string;
  detail?: string;
  seedKey?: string;
}

const STAGES = [
  { label: "Preparing syllabus and exam context", target: 18 },
  { label: "Generating questions from the selected topic", target: 52 },
  { label: "Checking duplicates and validating quality", target: 78 },
  { label: "Saving the paper and answer key", target: 92 },
  { label: "Opening your paper", target: 98 },
] as const;

export function GenerationProgressCard({
  title,
  description,
  detail,
  seedKey,
}: GenerationProgressCardProps) {
  const progressSeed = useMemo(
    () => seedKey ?? `${title}:${description}:${detail ?? ""}`,
    [description, detail, seedKey, title],
  );
  const [progress, setProgress] = useState(7);

  useEffect(() => {
    setProgress(7);

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 98) return current;
        const increment = current < 45 ? 4 : current < 75 ? 3 : current < 90 ? 2 : 1;
        return Math.min(current + increment, 98);
      });
    }, 850);

    return () => window.clearInterval(interval);
  }, [progressSeed]);

  const activeStage =
    STAGES.find((stage, index) => {
      const nextStage = STAGES[index + 1];
      return progress <= stage.target || (!nextStage && progress >= stage.target);
    }) ?? STAGES[STAGES.length - 1];

  return (
    <div className="bg-soft-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="card-surface card-glow w-full max-w-xl p-8 sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-primary">Paper generation in progress</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
              Progress
            </p>
            <p className="mt-1 text-3xl font-bold text-primary">{progress}%</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">{description}</p>

        <div className="mt-6">
          <Progress value={progress} className="h-3 rounded-full" />
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{activeStage.label}</span>
            <span className="text-muted-foreground">
              {progress < 100 ? "Please keep this tab open." : "Done"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-4 text-sm text-muted-foreground">
          <p>Stages: syllabus grounding, question generation, validation, persistence, render.</p>
          {detail ? <p>{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}
