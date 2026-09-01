import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaperNameEditor } from "@/components/PaperNameEditor";
import { useAppState } from "@/context/app-state";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — MockPaper" },
      { name: "description", content: "Your MockPaper profile and generated paper history." },
      { property: "og:title", content: "Profile — MockPaper" },
      { property: "og:description", content: "View your account details and past question papers." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, history, renamePaper, historyLoading } = useAppState();

  if (!user) {
    return (
      <div className="bg-soft-gradient glow-field flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="card-surface card-glow max-w-md p-10 text-center">
          <span className="eyebrow text-primary">MockPaper</span>
          <h1 className="mt-2 text-2xl font-bold">You are not logged in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in to view your profile and paper history.
          </p>
          <Button asChild className="mt-6">
            <Link to="/login">Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  const rows = [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email },
  ];

  return (
    <div className="bg-soft-gradient glow-field min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <span className="eyebrow text-primary">Your account</span>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Profile</h1>
      <div className="card-surface mt-6 divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 px-5 py-4 text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium text-foreground">{r.value}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-bold sm:text-2xl">History</h2>
      {historyLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading your papers...</p>
      ) : history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No question papers generated yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {history.map((p) => (
            <li key={p.id} className="relative">
              <Link
                to="/history/$id"
                params={{ id: p.id }}
                className="card-surface flex items-center gap-4 px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="bg-gold-soft text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1 pr-10">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString()} · {p.questions.length} questions ·{" "}
                    {p.mode === "full-paper" ? "Full Paper" : "Individual Question"}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
              <div className="absolute top-1/2 right-11 -translate-y-1/2 text-sm">
                <PaperNameEditor name={p.title} onSave={(name) => renamePaper(p.id, name)} nameHidden />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button asChild size="lg" className="mt-10">
        <Link to="/generate">Generate Question Paper</Link>
      </Button>
      </div>
    </div>
  );
}
