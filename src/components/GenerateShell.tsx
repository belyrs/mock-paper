import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Stepper, type StepName } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/context/app-state";
import { cn } from "@/lib/utils";

export function GenerateShell({
  step,
  title,
  titleSlot,
  subtitle,
  back,
  children,
}: {
  step: StepName;
  title: string;
  titleSlot?: React.ReactNode | undefined;
  subtitle?: string | undefined;
  back?: { to: string; label: string } | undefined;
  children: React.ReactNode;
}) {
  const { user, hydrated, sessionLoading } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !sessionLoading && !user) void navigate({ to: "/login", replace: true });
  }, [hydrated, sessionLoading, user, navigate]);

  if (!hydrated || sessionLoading || !user) {
    return (
      <div className="bg-soft-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Checking your session…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-soft-gradient glow-field min-h-[calc(100vh-4rem)] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Stepper current={step} />
        <div className="mt-8">
          {back && (
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 gap-1 text-muted-foreground">
              <Link to={back.to}>
                <ChevronLeft className="size-4" /> {back.label}
              </Link>
            </Button>
          )}
          {titleSlot ? (
            <div className="text-3xl font-bold sm:text-4xl">{titleSlot}</div>
          ) : (
            <h1 className="text-3xl font-bold text-balance sm:text-4xl">{title}</h1>
          )}
          {subtitle && <p className="mt-2.5 max-w-2xl text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function ChoiceCard({
  title,
  description,
  selected,
  onClick,
  meta,
}: {
  title: string;
  description?: string | undefined;
  selected?: boolean | undefined;
  onClick: () => void;
  meta?: React.ReactNode | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "card-surface group relative w-full overflow-hidden p-6 text-left transition-all duration-200",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-lift)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        selected && "border-primary/40 shadow-[var(--shadow-lift)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-opacity duration-200",
          "bg-gold-gradient",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        )}
      />
      <h2 className="text-xl font-bold">{title}</h2>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      {meta && <div className="mt-4">{meta}</div>}
    </button>
  );
}
