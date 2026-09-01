import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Clock,
  FileText,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Zap,
} from "lucide-react";
import { HeroPreview } from "@/components/HeroPreview";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/context/app-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MockPaper — Generate JEE & NEET Questions Instantly" },
      {
        name: "description",
        content:
          "Create customised JEE and NEET question papers by class, exam, subject, chapter, sub-topic, count and difficulty.",
      },
      { property: "og:title", content: "MockPaper — Generate JEE & NEET Questions Instantly" },
      {
        property: "og:description",
        content:
          "Generate full papers or individual questions for Class 11 and Class 12 JEE and NEET preparation.",
      },
    ],
  }),
  component: Home,
});

const highlights = [
  { icon: FileText, title: "Customise Everything", body: "Exam, class, subject, chapter and sub-topic." },
  { icon: Target, title: "Question Papers in Seconds", body: "Full papers or a single focused question set." },
  { icon: KeyRound, title: "Detailed Answer Key", body: "Every paper ships with a separate answer key." },
  { icon: BarChart3, title: "Well-Structured & Easy to Use", body: "Clean layout, ready to print or download." },
];

const trust = [
  { icon: ShieldCheck, label: "Secure & Private" },
  { icon: Clock, label: "Saves Hours" },
  { icon: SlidersHorizontal, label: "Built for Educators" },
];

function Home() {
  const { user } = useAppState();

  return (
    <div className="bg-soft-gradient">
      {/* Hero */}
      <section className="bg-hero-gradient relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(45% 55% at 85% 15%, oklch(1 0 0 / 0.55), transparent 70%), radial-gradient(50% 60% at 5% 90%, oklch(1 0 0 / 0.35), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface/70 px-4 py-1.5 text-[13px] font-semibold text-primary backdrop-blur">
              <Zap className="size-4" /> Instant Mock Paper Creation
            </span>
            <h1 className="mt-6 text-4xl leading-[1.05] font-bold text-balance text-primary sm:text-5xl md:text-6xl">
              Design Mock Exam Papers.
              <br />
              Save Hours.
              <br />
              Teach Better.
            </h1>
            <p className="mt-6 max-w-xl text-base text-pretty text-primary/80 sm:text-lg">
              Create high-quality, customised JEE &amp; NEET question papers in seconds. Tailor by
              class, exam, subject, chapter, sub-topic, number of questions and difficulty level —
              from Easy to Hard.
            </p>

            {user ? (
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/generate">
                    Generate Question Paper <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/profile">My papers</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="gap-2">
                    <Link to="/login">
                      Log in <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-primary/30 bg-transparent text-primary hover:bg-surface/70"
                  >
                    <Link to="/signup">Sign up</Link>
                  </Button>
                </div>
                <p className="mt-4 text-sm font-medium text-primary/70">
                  Log in to start generating question papers.
                </p>
              </>
            )}

            <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              {trust.map((t) => (
                <li key={t.label} className="flex items-center gap-2 text-sm font-semibold text-primary/85">
                  <t.icon className="size-4" /> {t.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr] lg:gap-5">
            <HeroPreview />
            <ul className="grid gap-5 self-center sm:gap-6">
              {highlights.map((h) => (
                <li key={h.title} className="flex gap-3 sm:block">
                  <h.icon className="size-5 shrink-0 text-primary sm:mb-2" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary">{h.title}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature band */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-primary">How it works</p>
          <h2 className="mt-3 text-3xl font-bold text-balance sm:text-4xl">
            Everything you need to build a paper
          </h2>
          <p className="mt-3 text-muted-foreground">
            A guided five-step flow: pick the exam, class and mode, configure each subject, and
            review your generated questions with a full answer key.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h) => (
            <article
              key={h.title}
              className="card-surface group p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gold-soft text-accent-foreground transition-colors group-hover:bg-gold-gradient">
                <h.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-bold">{h.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{h.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="bg-brand-gradient relative overflow-hidden rounded-3xl px-6 py-14 text-center shadow-[var(--shadow-lift)] sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(40% 60% at 85% 10%, oklch(0.86 0.16 84 / 0.35), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-bold text-balance text-primary-foreground sm:text-4xl">
              Your next mock paper is minutes away
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Set the chapters and the difficulty split, and get a print-ready paper with its answer
              key.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" variant="gold" className="gap-2">
                <Link to={user ? "/generate" : "/signup"}>
                  {user ? "Generate Question Paper" : "Get started free"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
