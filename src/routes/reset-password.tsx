import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/context/app-state";
import { AuthShell, Field } from "./login";

const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  head: () => ({
    meta: [
      { title: "Reset Password — MockPaper" },
      {
        name: "description",
        content: "Set a new password for your MockPaper account using your reset token.",
      },
      { property: "og:title", content: "Reset Password — MockPaper" },
      {
        property: "og:description",
        content: "Complete your MockPaper password reset securely.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { confirmPasswordReset } = useAppState();
  const [token, setToken] = useState(search.token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const next: Record<string, string> = {};
    if (!token.trim()) next["token"] = "Reset token is required.";
    if (!password) next["password"] = "Password is required.";
    else if (password.length < 8) next["password"] = "Use at least 8 characters.";
    if (confirm !== password) next["confirm"] = "Passwords do not match.";
    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await confirmPasswordReset(token.trim(), password);
      toast.success("Password updated. Please log in with your new password.");
      void navigate({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Paste the reset token from your email or console preview and choose a new password."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Reset Token" error={errors["token"]}>
          <Input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste your reset token"
          />
        </Field>
        <Field label="New Password" error={errors["password"]}>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Confirm New Password" error={errors["confirm"]}>
          <Input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Updating Password..." : "Update Password"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
