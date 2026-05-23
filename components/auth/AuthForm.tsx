"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login, signup, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const TEST_EMAIL = "test@flights.dev";
const TEST_PASSWORD = "Passw0rd!";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  const redirectTo = useSearchParams().get("redirect") ?? "/";
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillTestCredentials() {
    const setNativeValue = (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    if (emailRef.current) setNativeValue(emailRef.current, TEST_EMAIL);
    if (passwordRef.current) setNativeValue(passwordRef.current, TEST_PASSWORD);
    emailRef.current?.focus();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "login"
          ? "Welcome back to SkyBook."
          : "Start booking flights in seconds."}
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <Input
          ref={emailRef}
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Input
          ref={passwordRef}
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {mode === "login" && (
          <button
            type="button"
            onClick={fillTestCredentials}
            className="cursor-pointer rounded-lg border border-dashed border-brand-600/40 bg-brand-600/5 p-3 text-left text-xs transition hover:border-brand-600 hover:bg-brand-600/10"
          >
            <span className="block font-medium text-brand-600">
              Use test credentials
            </span>
            <span className="mt-1 block font-mono text-[11px] text-muted">
              {TEST_EMAIL} / {TEST_PASSWORD}
            </span>
            <span className="mt-1 block text-[11px] text-muted">
              Click to autofill
            </span>
          </button>
        )}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.message && (
          <p className="text-sm text-success">{state.message}</p>
        )}

        <Button type="submit" disabled={pending} className="mt-2">
          {pending && <Spinner className="h-4 w-4" />}
          {mode === "login" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-brand-600">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
