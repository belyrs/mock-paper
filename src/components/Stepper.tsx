import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Exam", "Class", "Mode", "Configure", "Questions"] as const;
export type StepName = (typeof STEPS)[number];

export function Stepper({ current }: { current: StepName }) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label="Progress" className="w-full overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step} className="flex items-center gap-2 sm:gap-3">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-2.5 py-1.5 transition-all duration-200",
                  active
                    ? "border-primary/25 bg-surface shadow-[var(--shadow-card)]"
                    : "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                    done && "border-transparent bg-gold text-gold-foreground",
                    active && "border-transparent bg-brand-gradient text-primary-foreground",
                    !done && !active && "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold sm:text-sm",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-0.5 w-6 rounded-full transition-colors sm:w-10",
                    done ? "bg-gold" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
