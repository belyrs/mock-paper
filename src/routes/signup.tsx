import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/context/app-state";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — MockPaper" },
      {
        name: "description",
        content: "Create a free MockPaper account to generate JEE and NEET question papers.",
      },
      { property: "og:title", content: "Sign Up — MockPaper" },
      {
        property: "og:description",
        content: "Create your account and start generating practice papers.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signup } = useAppState();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next["name"] = "Name is required.";
    if (!form.email.trim()) next["email"] = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next["email"] = "Enter a valid email address.";
    if (!form.password) next["password"] = "Password is required.";
    else if (form.password.length < 8) next["password"] = "Use at least 8 characters.";
    if (form.confirm !== form.password) next["confirm"] = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await signup(form.name.trim(), form.email.trim(), form.password);
      toast.success("Account created");
      void navigate({ to: "/generate" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start generating JEE & NEET practice papers.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Name" error={errors["name"]}>
          <Input value={form.name} onChange={set("name")} placeholder="Your full name" />
        </Field>
        <Field label="Email" error={errors["email"]}>
          <Input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" error={errors["password"]}>
          <Input
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Confirm Password" error={errors["confirm"]}>
          <Input
            type="password"
            value={form.confirm}
            onChange={set("confirm")}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
