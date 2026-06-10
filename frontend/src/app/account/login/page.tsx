"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SignInPanel } from "@/components/SignInPanel";
import { Reveal } from "@/components/motion/Reveal";

function AccountAuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { authenticated } = useAuth();
  const next = params.get("next") || "/account";

  // Already signed in -> bounce to the intended destination.
  useEffect(() => {
    if (authenticated) router.replace(next);
  }, [authenticated, next, router]);

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal className="mx-auto max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate2 transition-colors hover:text-graphite"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="glass rounded-3xl p-7 sm:p-9">
          <h1 className="font-display text-3xl font-bold tracking-tightest text-graphite">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate2">
            Use your Google or Apple account — it&rsquo;s how you check out and
            access your download library.
          </p>
          <div className="mt-6">
            <SignInPanel onDone={() => router.replace(next)} />
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-xl pt-44" />}>
      <AccountAuthForm />
    </Suspense>
  );
}
