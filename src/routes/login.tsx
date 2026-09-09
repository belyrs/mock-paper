import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState } from "@/context/app-state";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — MockPaper" },
      {
        name: "description",
        content: "Log in to generate JEE and NEET question papers instantly.",
      },
      { property: "og:title", content: "Login — MockPaper" },
      {
        property: "og:description",
        content: "Access your MockPaper question generator.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, requestPasswordReset } = useAppState();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) next["email"] = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email))
      next["email"] = "Enter a valid email address.";
    if (!password) next["password"] = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Logged in");
      void navigate({ to: "/generate" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue generating question papers."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email" error={errors["email"]}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" error={errors["password"]}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <button
          type="button"
          onClick={async () => {
            if (!email.trim()) {
              toast.error("Enter your email first.");
              return;
            }

            try {
              const reset = await requestPasswordReset(email.trim());
              if (reset.previewUrl) {
                const token = new URL(reset.previewUrl).searchParams.get(
                  "token",
                );
                toast.success(
                  "Reset link generated. Redirecting to the password reset form.",
                );
                if (token) {
                  void navigate({
                    to: "/reset-password",
                    search: { token },
                  });
                  return;
                }
              } else {
                toast.success("Password reset link sent.");
              }
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Password reset failed",
              );
            }
          }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Forgot Password?
        </button>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? "Logging in..." : "Login"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Sign Up
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-canvas min-h-[calc(100vh-4rem)] px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <div className="card-surface card-glow overflow-hidden border-gold/35">
          <div className="h-2 bg-gold-gradient" />
          <div className="p-6 sm:p-8">
            <span className="eyebrow text-primary">MockPaper Studio</span>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
            <p className="mt-2 mb-7 text-sm text-muted-foreground">
              {subtitle}
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
