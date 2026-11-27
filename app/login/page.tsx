"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((response) => response.json())
      .then((body: { required?: boolean }) => {
        if (!body.required) router.replace("/");
      })
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("That PIN doesn’t match.");
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
          <SunMedium className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Filosofo Solar</h1>
          <p className="text-sm text-muted-foreground">Enter the access PIN to open the plant.</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="PIN"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          aria-label="Access PIN"
        />
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy || pin.length === 0}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
