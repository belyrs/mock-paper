import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { GenerationProgressCard } from "@/components/GenerationProgressCard";
import { toast } from "sonner";
import { DownloadDialog } from "@/components/DownloadDialog";
import { GenerateShell } from "@/components/GenerateShell";
import { PaperNameEditor } from "@/components/PaperNameEditor";
import { QuestionCard } from "@/components/QuestionCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState } from "@/context/app-state";
import { EXAMS, LETTERS } from "@/lib/mock-generator";

export const Route = createFileRoute("/generate/paper")({
  head: () => ({
    meta: [
      { title: "Generated Paper — MockPaper" },
      {
        name: "description",
        content:
          "Review your generated questions and answer key, and regenerate as needed.",
      },
      { property: "og:title", content: "Generated Paper — MockPaper" },
      {
        property: "og:description",
        content: "Your generated questions with a full answer key.",
      },
    ],
  }),
  component: PaperPage,
});

function PaperPage() {
  const {
    classLevel,
    exam,
    currentPaper,
    currentPaperId,
    currentPaperLoading,
    regeneratePaper,
    regenerateQuestion,
    renamePaper,
    updateQuestion,
  } = useAppState();
  const navigate = useNavigate();

  const [regenAll, setRegenAll] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);

  const finish = () => void navigate({ to: "/generate" });

  if (regenAll) {
    return (
      <GenerationProgressCard
        title="Generating your paper..."
        description="Creating a brand new set of questions using your saved configuration."
        detail="Your previous configuration is loaded, the questions are regenerated, validated, and then this paper view is refreshed."
        seedKey={`regen:${currentPaperId ?? "paper"}`}
      />
    );
  }

  if (currentPaperLoading && currentPaperId) {
    return (
      <GenerationProgressCard
        title="Preparing your paper..."
        description="Your generated paper is being fetched and rendered for review."
        detail="The paper is ready. Loading the saved questions, answer key, and review details."
        seedKey={`load:${currentPaperId}`}
      />
    );
  }

  if (!currentPaper || currentPaper.questions.length === 0) {
    return (
      <GenerateShell step="Questions" title="No paper generated yet">
        <p className="text-muted-foreground">
          Configure a paper to see generated questions here.
        </p>
        <Button asChild className="mt-6">
          <Link to="/generate">Start generating</Link>
        </Button>
      </GenerateShell>
    );
  }

  const questions = currentPaper.questions;
  const paperName =
    currentPaper.title ??
    (exam && classLevel
      ? `${EXAMS[exam].label} — ${classLevel}`
      : "Generated Paper");

  const regenerateAll = async () => {
    setRegenAll(true);
    try {
      const paper = await regeneratePaper(currentPaper.id);
      await navigate({ to: "/generate/paper" });
      return paper;
    } catch (error) {
      setRegenAll(false);
      toast.error(
        error instanceof Error ? error.message : "Paper regeneration failed",
      );
      return null;
    }
  };

  const regenerateOne = async (id: string) => {
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    setRegenId(id);
    try {
      await regenerateQuestion(currentPaper.id, id);
      setRegenId(null);
    } catch (error) {
      setRegenId(null);
      toast.error(
        error instanceof Error ? error.message : "Question regeneration failed",
      );
    }
  };

  return (
    <GenerateShell
      step="Questions"
      title={paperName}
      titleSlot={
        currentPaperId ? (
          <PaperNameEditor
            name={paperName}
            onSave={async (name) => renamePaper(currentPaperId, name)}
          />
        ) : null
      }
      back={{ to: "/generate/configure", label: "Back to configuration" }}
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2" onClick={regenerateAll}>
          <RefreshCw className="size-4" /> Regenerate Entire Paper
        </Button>
        <DownloadDialog
          title={paperName}
          questions={questions}
          exam={currentPaper.exam}
          classLevel={currentPaper.classLevel}
        />
        <Button className="gap-2" onClick={finish}>
          <CheckCircle2 className="size-4" /> Done
        </Button>
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="answers">Answer Key</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-6 space-y-5">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              index={i}
              question={q}
              loading={regenId === q.id}
              onRegenerate={() => void regenerateOne(q.id)}
              onEdit={(input) => updateQuestion(currentPaper.id, q.id, input)}
            />
          ))}
        </TabsContent>

        <TabsContent value="answers" className="mt-6">
          <section className="card-surface p-5 sm:p-6">
            <h2 className="eyebrow flex items-center gap-2 text-primary">
              <span className="bg-gold-gradient inline-block size-2 rounded-full" />{" "}
              Answer Key
            </h2>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    {i + 1}.{" "}
                    <span className="text-foreground">{q.subject}</span>
                  </span>
                  <span className="bg-gold-soft text-accent-foreground flex size-6 items-center justify-center rounded-md text-xs font-bold">
                    {LETTERS[q.correctIndex]}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-5 grid gap-3">
              {questions.map((q, i) => (
                <article
                  key={`${q.id}-analysis`}
                  className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
                >
                  <p className="font-semibold">
                    {i + 1}. {q.conceptTested}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Common mistake: {q.commonMistake}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Remedial action: {q.recommendedRemedialAction}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Learning outcome: {q.learningOutcome}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Bloom's level: {q.bloomsTaxonomyLevel}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </GenerateShell>
  );
}
