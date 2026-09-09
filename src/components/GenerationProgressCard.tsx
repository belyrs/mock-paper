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
        const increment =
          current < 25
            ? 2
            : current < 55
              ? 1
              : current < 75
                ? 0.5
                : current < 90
                  ? 0.25
                  : 0.1;
        return Math.min(current + increment, 98);
      });
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [progressSeed]);

  const activeStage =
    STAGES.find((stage, index) => {
      const nextStage = STAGES[index + 1];
      return (
        progress <= stage.target || (!nextStage && progress >= stage.target)
      );
    }) ?? STAGES[STAGES.length - 1];

  return (
    <div className="app-canvas flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="card-surface card-glow w-full max-w-xl overflow-hidden border-gold/35 p-0">
        <div className="h-2 bg-gold-gradient" />
        <div className="p-8 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-primary">
                Paper generation in progress
              </p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
            </div>
            <div className="rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
                Progress
              </p>
              <p className="mt-1 text-3xl font-bold text-primary">
                {Math.floor(progress)}%
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          <div className="mt-6">
            <Progress value={progress} className="h-3 rounded-full" />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">
                {activeStage.label}
              </span>
              <span className="text-muted-foreground">
                {progress < 100 ? "Please keep this tab open." : "Done"}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-2 rounded-2xl border border-gold/25 bg-surface-muted px-4 py-4 text-sm text-muted-foreground">
            <p>
              Stages: syllabus grounding, question generation, validation,
              persistence, render.
            </p>
            {detail ? <p>{detail}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
