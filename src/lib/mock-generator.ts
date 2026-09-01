import type {
  ClassLevel,
  Difficulty,
  DifficultyMix,
  ExamId,
  Mode,
  Paper,
  Question,
  SubjectConfig,
} from "@/types/api";

export type { ClassLevel, Difficulty, DifficultyMix, ExamId, Mode, Paper, Question, SubjectConfig };

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export const EXAMS: Record<
  ExamId,
  { id: ExamId; label: string; stream: string; subjects: string[]; blurb: string }
> = {
  JEE: {
    id: "JEE",
    label: "JEE",
    stream: "PCM",
    subjects: ["Physics", "Chemistry", "Mathematics"],
    blurb: "Engineering entrance preparation",
  },
  NEET: {
    id: "NEET",
    label: "NEET",
    stream: "PCB",
    subjects: ["Physics", "Chemistry", "Biology"],
    blurb: "Medical entrance preparation",
  },
};

export const defaultMix = (): DifficultyMix => ({ Easy: 30, Medium: 50, Hard: 20 });

export const emptySubjectConfig = (): SubjectConfig => ({
  chapter: "",
  subTopic: "",
  numberOfQuestions: 10,
  mix: defaultMix(),
});

export function mixToCounts(mix: DifficultyMix, total: number): DifficultyMix {
  const safeTotal = Math.max(0, Math.floor(total));
  const raw = DIFFICULTIES.map((difficulty) => ((mix[difficulty] ?? 0) * safeTotal) / 100);
  const counts = raw.map((value) => Math.floor(value));
  let remaining = safeTotal - counts.reduce((sum, value) => sum + value, 0);

  const fractions = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);

  let cursor = 0;
  while (remaining > 0 && fractions.length > 0) {
    const nextIndex = fractions[cursor % fractions.length]?.index ?? 0;
    counts[nextIndex] = (counts[nextIndex] ?? 0) + 1;
    remaining -= 1;
    cursor += 1;
  }

  return {
    Easy: counts[0] ?? 0,
    Medium: counts[1] ?? 0,
    Hard: counts[2] ?? 0,
  };
}

export function rebalanceMix(mix: DifficultyMix, changed: Difficulty, value: number): DifficultyMix {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));
  const others = DIFFICULTIES.filter((difficulty) => difficulty !== changed);
  const remaining = 100 - safeValue;
  const previousOthersTotal = others.reduce((sum, difficulty) => sum + (mix[difficulty] ?? 0), 0);
  const next: DifficultyMix = { Easy: 0, Medium: 0, Hard: 0 };

  next[changed] = safeValue;

  if (previousOthersTotal === 0) {
    next[others[0]!] = remaining;
    next[others[1]!] = 0;
  } else {
    const first = Math.round(((mix[others[0]!] ?? 0) / previousOthersTotal) * remaining);
    next[others[0]!] = Math.min(remaining, first);
    next[others[1]!] = remaining - next[others[0]!];
  }

  return next;
}

export const LETTERS = ["A", "B", "C", "D"] as const;
