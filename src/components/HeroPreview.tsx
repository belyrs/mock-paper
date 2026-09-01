import { ChevronDown } from "lucide-react";

const rows = [
  { label: "Subject", value: "Physics", select: true },
  { label: "Chapter", value: "Thermodynamics" },
  { label: "Sub-topic", value: "Molar Heat Capacities" },
  { label: "Number of Questions", value: "20" },
];

const mix = [
  { label: "Easy", note: "6 questions", pct: 30 },
  { label: "Medium", note: "10 questions", pct: 50 },
  { label: "Hard", note: "4 questions", pct: 20 },
];

/** Decorative, non-interactive preview of the paper configuration screen. */
export function HeroPreview() {
  return (
    <div aria-hidden className="relative select-none">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gold-gradient opacity-40 blur-3xl" />
      <div className="card-surface card-glow rounded-3xl p-5 sm:p-6">
        <div className="space-y-3.5">
          {rows.map((r) => (
            <div key={r.label} className="space-y-1.5">
              <p className="text-[12px] font-semibold text-muted-foreground">{r.label}</p>
              <div className="flex h-10 items-center justify-between rounded-xl border border-border bg-surface-muted px-3 text-sm font-medium text-foreground">
                <span>{r.value}</span>
                {r.select && <ChevronDown className="size-4 text-muted-foreground" />}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-bold">Difficulty distribution</p>
            <span className="text-xs font-semibold text-primary">Total 100%</span>
          </div>
          <div className="mt-3 space-y-3">
            {mix.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    {m.label} <span className="text-muted-foreground/70">({m.note})</span>
                  </span>
                  <span className="font-bold text-primary">{m.pct}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-brand-gradient"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
