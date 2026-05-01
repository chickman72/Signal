"use client";

import { useEffect, useState } from "react";
import type { User } from "../types";

type AdminGuardProps = {
  children: React.ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("signal_user");
    if (!stored) {
      setAuthorized(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as User;
      setAuthorized(parsed.role === "administrator");
    } catch {
      setAuthorized(false);
    }
  }, []);

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
        <p className="text-sm text-slate-600">Checking admin access...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-700">Admin access only.</p>
          <a href="/" className="mt-3 inline-flex text-xs uppercase tracking-wide text-cyan-700">
            Return home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
