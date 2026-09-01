import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadDialog } from "@/components/DownloadDialog";
import { PaperNameEditor } from "@/components/PaperNameEditor";
import { useAppState } from "@/context/app-state";
import { LETTERS } from "@/lib/mock-generator";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Saved Paper — MockPaper" },
      {
        name: "description",
        content:
          "Review the questions and answer key of a previously generated question paper.",
      },
      { property: "og:title", content: "Saved Paper — MockPaper" },
      {
        property: "og:description",
        content: "All questions from this generated paper.",
      },
    ],
  }),
  component: HistoryDetail,
});

function HistoryDetail() {
  const { id } = Route.useParams();
  const { hydrated, history, renamePaper, historyLoading } = useAppState();
  const paper = history.find((p) => p.id === id);

  if (!hydrated || historyLoading)
    return <div className="mx-auto max-w-3xl px-4 py-20" />;

  if (!paper) {
    return (
      <div className="bg-soft-gradient glow-field flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="card-surface card-glow max-w-md p-10 text-center">
          <h1 className="text-2xl font-bold">Paper not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This question paper is no longer in your history.
          </p>
          <Button asChild className="mt-6">
            <Link to="/profile">Back to profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-soft-gradient glow-field min-h-[calc(100vh-4rem)] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to profile
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-3xl font-bold">
              <PaperNameEditor
                name={paper.title}
                onSave={(name) => renamePaper(paper.id, name)}
              />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {new Date(paper.createdAt).toLocaleString()} ·{" "}
              {paper.questions.length} questions ·{" "}
              {paper.mode === "full-paper"
                ? "Full Paper"
                : "Individual Question"}
            </p>
          </div>
          <DownloadDialog
            title={paper.title}
            questions={paper.questions}
            exam={paper.exam}
            classLevel={paper.classLevel}
          />
        </div>

        <Tabs defaultValue="questions" className="mt-8">
          <TabsList>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="answers">Answer Key</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-6 space-y-5">
            {paper.questions.map((q, i) => (
              <article
                key={q.id}
                className="card-surface p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)] sm:p-6"
              >
                <h2 className="text-base font-semibold">Question {i + 1}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{q.subject}</Badge>
                  <Badge variant="outline">{q.chapter}</Badge>
                  <Badge variant="outline">{q.subTopic}</Badge>
                  <Badge variant="gold">{q.difficulty}</Badge>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed">{q.text}</p>
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oi) => (
                    <li
                      key={oi}
                      className="flex gap-2.5 rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm transition-colors hover:border-primary/30"
                    >
                      <span className="font-semibold text-primary">
                        {LETTERS[oi]}.
                      </span>
                      <span>{opt}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </TabsContent>

          <TabsContent value="answers" className="mt-6">
            <section className="card-surface p-5 sm:p-6">
              <h2 className="eyebrow flex items-center gap-2 text-primary">
                <span className="bg-gold-gradient inline-block size-2 rounded-full" />{" "}
                Answer Key
              </h2>
              <div className="mt-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
                <p className="font-semibold">
                  Historical Analysis Mode: {paper.historicalAnalysisMode}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {paper.historicalAnalysisSummary.trendSummary}
                </p>
              </div>
              <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {paper.questions.map((q, i) => (
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
                {paper.questions.map((q, i) => (
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
      </div>
    </div>
  );
}
