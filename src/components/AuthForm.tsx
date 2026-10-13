"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Input, Spinner } from "./ui";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError(undefined);
    try {
      if (mode === "register") {
        await api("/api/register", { method: "POST", json: { name: form.get("name"), email, password } });
      }
      const res = await signIn("credentials", { email, password, redirect: false });
      if (!res || res.error) throw new Error("Wrong email or password");
      // Only follow same-site paths, never a full URL from the query string
      const next = new URLSearchParams(window.location.search).get("callbackUrl");
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/map";
      router.replace(mode === "register" ? "/import" : safeNext);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      {mode === "register" && <Input label="Name" name="name" autoComplete="name" required />}
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        minLength={mode === "register" ? 8 : undefined}
        required
      />
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Spinner />} {mode === "login" ? "Log in" : "Sign up"}
      </Button>
      <p className="text-center text-sm text-ink-2">
        {mode === "login" ? (
          <>No account? <Link href="/register" className="font-medium text-accent">Sign up</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="font-medium text-accent">Log in</Link></>
        )}
      </p>
    </form>
  );
}
