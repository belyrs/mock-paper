import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { GenerationProgressCard } from "@/components/GenerationProgressCard";
import { toast } from "sonner";
import { GenerateShell } from "@/components/GenerateShell";
import { DifficultyMixSliders } from "@/components/DifficultySlider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppState } from "@/context/app-state";
import {
  DIFFICULTIES,
  EXAMS,
  defaultMix,
  emptySubjectConfig,
  type SubjectConfig,
} from "@/lib/mock-generator";
import { getChapterOptions } from "@/lib/syllabus";

export const Route = createFileRoute("/generate/configure")({
  head: () => ({
    meta: [
      { title: "Configure Your Paper — MockPaper" },
      {
        name: "description",
        content:
          "Set chapter, sub-topic, number of questions and difficulty for each subject before generating.",
      },
      { property: "og:title", content: "Configure Your Paper — MockPaper" },
      { property: "og:description", content: "Fine-tune your paper before generating." },
    ],
  }),
  component: ConfigurePage,
});

type Errors = Record<string, Record<string, string>>;

function validateConfig(
  cfg: SubjectConfig,
  classLevel: "Class 11" | "Class 12",
  subject: string,
): Record<string, string> {
  const e: Record<string, string> = {};
  const chapterOptions = getChapterOptions(classLevel, subject);
  if (!cfg.chapter.trim()) e["chapter"] = "Chapter is required.";
  else if (chapterOptions.length > 0 && !chapterOptions.includes(cfg.chapter.trim())) {
    e["chapter"] = "Please select a valid chapter.";
  }
  if (!cfg.subTopic.trim()) e["subTopic"] = "Sub-topic is required.";
  if (!cfg.numberOfQuestions || cfg.numberOfQuestions < 1)
    e["numberOfQuestions"] = "Enter a valid number of questions (1 or more).";
  else if (cfg.numberOfQuestions > 50) e["numberOfQuestions"] = "Maximum 50 questions.";
  const mixTotal = DIFFICULTIES.reduce((a, d) => a + (cfg.mix?.[d] ?? 0), 0);
  if (mixTotal !== 100) e["mix"] = "Difficulty percentages must total 100%.";
  return e;
}

function ConfigurePage() {
  const {
    classLevel,
    exam,
    mode,
    fullPaperConfig,
    individualSubject,
    individualConfig,
    setFullPaperConfig,
    setIndividualSubject,
    setIndividualConfig,
    generatePaper,
  } = useAppState();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Errors>({});
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  if (!classLevel || !exam || !mode) {
    return (
      <GenerateShell step="Configure" title="Setup incomplete">
        <p className="text-muted-foreground">
          Please choose your class, examination and generation mode first.
        </p>
        <Button asChild className="mt-6">
          <Link to="/generate">Start over</Link>
        </Button>
      </GenerateShell>
    );
  }

  const examMeta = EXAMS[exam];
  const subjects = examMeta.subjects;

  const run = () => {
    setGenerationError(null);
    if (mode === "full-paper") {
      const next: Errors = {};
      for (const s of subjects) {
        const errs = validateConfig(fullPaperConfig[s] ?? emptySubjectConfig(), classLevel, s);
        if (Object.keys(errs).length) next[s] = errs;
      }
      setErrors(next);
      if (Object.keys(next).length) return;
      const entries = subjects.map((s) => ({
        subject: s,
        config: fullPaperConfig[s] ?? emptySubjectConfig(),
      }));
      void simulate(async () => {
        await generatePaper();
      });
    } else {
      const errs = validateConfig(individualConfig, classLevel, individualSubject);
      if (!individualSubject) errs["subject"] = "Subject is required.";
      setErrors(Object.keys(errs).length ? { individual: errs } : {});
      if (Object.keys(errs).length) return;
      void simulate(async () => {
        await generatePaper();
      });
    }
  };

  const simulate = async (fn: () => Promise<void>) => {
    setGenerating(true);
    try {
      await fn();
      await navigate({ to: "/generate/paper" });
    } catch (error) {
      setGenerating(false);
      const message = error instanceof Error ? error.message : "Paper generation failed";
      setGenerationError(message);
      toast.error(message);
    }
  };

  if (generating) return <GeneratingState />;
  if (generationError) {
    return <GenerationFailureState message={generationError} onRetry={run} onEdit={() => setGenerationError(null)} />;
  }

  const headline =
    mode === "full-paper"
      ? `Configure ${examMeta.label} Full Paper`
      : "Generate Individual Question";

  const handleIndividualSubjectChange = (subject: string) => {
    if (subject !== individualSubject) {
      setIndividualConfig({ chapter: "", subTopic: "" });
    }
    setIndividualSubject(subject);
  };

  return (
    <GenerateShell
      step="Configure"
      title={headline}
      subtitle={`${classLevel} — ${examMeta.label} (${examMeta.stream})`}
      back={{ to: "/generate/mode", label: "Generation mode" }}
    >
      {mode === "full-paper" ? (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            {subjects.map((s) => {
              const cfg = fullPaperConfig[s] ?? emptySubjectConfig();
              const e = errors[s] ?? {};
              return (
                <section key={s} className="card-surface p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)] sm:p-6">
                  <h2 className="eyebrow flex items-center gap-2 text-primary">
                    <span className="bg-gold-gradient inline-block size-2 rounded-full" />
                    {s}
                  </h2>
                  <div className="mt-5 space-y-4">
                    <ConfigFields
                      cfg={cfg}
                      classLevel={classLevel}
                      subject={s}
                      errors={e}
                      idPrefix={s}
                      onChange={(patch) => setFullPaperConfig(s, patch)}
                    />
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-8 flex justify-center">
            <Button size="lg" className="gap-2" onClick={run}>
              <Sparkles className="size-4" /> Generate Full Paper
            </Button>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-xl">
          <section className="card-surface space-y-4 p-5 sm:p-6">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Select value={individualSubject} onValueChange={handleIndividualSubjectChange}>
                <SelectTrigger id="subject" className="w-full">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors["individual"]?.["subject"] && (
                <p className="text-xs font-medium text-destructive">
                  {errors["individual"]["subject"]}
                </p>
              )}
            </div>
            <ConfigFields
              cfg={individualConfig}
              classLevel={classLevel}
              subject={individualSubject}
              errors={errors["individual"] ?? {}}
              idPrefix="individual"
              onChange={setIndividualConfig}
            />
          </section>
          <div className="mt-8 flex justify-center">
            <Button size="lg" className="gap-2" onClick={run}>
              <Sparkles className="size-4" /> Generate
            </Button>
          </div>
        </div>
      )}
    </GenerateShell>
  );
}

function ConfigFields({
  cfg,
  classLevel,
  subject,
  errors,
  idPrefix,
  onChange,
}: {
  cfg: SubjectConfig;
  classLevel: "Class 11" | "Class 12";
  subject: string;
  errors: Record<string, string>;
  idPrefix: string;
  onChange: (patch: Partial<SubjectConfig>) => void;
}) {
  const chapterOptions = getChapterOptions(classLevel, subject);
  const chapterValue = chapterOptions.includes(cfg.chapter) ? cfg.chapter : "";

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-chapter`}>Chapter</Label>
        <Select
          value={chapterValue}
          onValueChange={(chapter) => onChange({ chapter })}
          disabled={chapterOptions.length === 0}
        >
          <SelectTrigger id={`${idPrefix}-chapter`} className="w-full">
            <SelectValue
              placeholder={subject ? "Select chapter" : "Select subject first"}
            />
          </SelectTrigger>
          <SelectContent>
            {chapterOptions.map((chapter) => (
              <SelectItem key={chapter} value={chapter}>
                {chapter}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["chapter"] && (
          <p className="text-xs font-medium text-destructive">{errors["chapter"]}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-subtopic`}>Sub-topic</Label>
        <Input
          id={`${idPrefix}-subtopic`}
          value={cfg.subTopic}
          placeholder="Type sub-topic"
          onChange={(e) => onChange({ subTopic: e.target.value })}
        />
        {errors["subTopic"] && (
          <p className="text-xs font-medium text-destructive">{errors["subTopic"]}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-count`}>Number of Questions</Label>
        <Input
          id={`${idPrefix}-count`}
          type="number"
          min={1}
          max={50}
          value={Number.isFinite(cfg.numberOfQuestions) ? cfg.numberOfQuestions : ""}
          onChange={(e) => onChange({ numberOfQuestions: Number(e.target.value) })}
        />
        {errors["numberOfQuestions"] && (
          <p className="text-xs font-medium text-destructive">{errors["numberOfQuestions"]}</p>
        )}
      </div>
      <DifficultyMixSliders
        idPrefix={idPrefix}
        value={cfg.mix ?? defaultMix()}
        total={cfg.numberOfQuestions}
        onChange={(mix) => onChange({ mix })}
      />
      {errors["mix"] && <p className="text-xs font-medium text-destructive">{errors["mix"]}</p>}
    </>
  );
}

function GeneratingState() {
  return (
    <GenerationProgressCard
      title="Generating your paper..."
      description="Creating questions based on your selected subjects, chapters, sub-topics and difficulty."
      detail="This can take around 20-60 seconds because each question is validated against the saved question bank before the paper is shown."
    />
  );
}

function GenerationFailureState({
  message,
  onRetry,
  onEdit,
}: {
  message: string;
  onRetry: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-soft-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="card-surface max-w-lg p-10 text-center">
        <AlertCircle className="mx-auto size-10 text-destructive" />
        <h1 className="mt-6 text-2xl font-bold">Paper generation needs another try</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onRetry} className="gap-2">
            <Sparkles className="size-4" /> Try again
          </Button>
          <Button variant="outline" onClick={onEdit}>
            Edit configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
