import { Slider } from "@/components/ui/slider";
import {
  DIFFICULTIES,
  defaultMix,
  mixToCounts,
  rebalanceMix,
  type Difficulty,
  type DifficultyMix,
} from "@/lib/mock-generator";

interface Props {
  value: DifficultyMix;
  total?: number;
  onChange: (mix: DifficultyMix) => void;
  idPrefix?: string;
}

export function DifficultyMixSliders({ value, total, onChange, idPrefix = "mix" }: Props) {
  const mix = value ?? defaultMix();
  const counts = total && total > 0 ? mixToCounts(mix, total) : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-muted/70 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold tracking-tight text-foreground">Difficulty distribution</span>
        <span className="text-xs font-semibold text-primary">Total 100%</span>
      </div>

      {DIFFICULTIES.map((d: Difficulty) => (
        <div key={d} className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor={`${idPrefix}-${d}`} className="text-[13px] font-medium text-muted-foreground">
              {d}
              {counts ? (
                <span className="ml-1.5 text-xs">
                  ({counts[d]} {counts[d] === 1 ? "question" : "questions"})
                </span>
              ) : null}
            </label>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-primary tabular-nums">{mix[d] ?? 0}%</span>
          </div>
          <Slider
            id={`${idPrefix}-${d}`}
            value={[mix[d] ?? 0]}
            min={0}
            max={100}
            step={5}
            aria-label={`${d} percentage`}
            onValueChange={(v) => onChange(rebalanceMix(mix, d, v[0] ?? 0))}
          />
        </div>
      ))}
    </div>
  );
}
