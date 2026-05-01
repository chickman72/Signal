"use client";

import { useEffect, useState } from "react";

type InstructorGuardProps = {
  children: React.ReactNode;
};

export default function InstructorGuard({ children }: InstructorGuardProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("signal_user");
      if (!raw) {
        setAuthorized(false);
        return;
      }
      const parsed = JSON.parse(raw) as { role?: string };
      setAuthorized(parsed.role === "instructor" || parsed.role === "administrator");
    } catch {
      setAuthorized(false);
    }
  }, []);

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <p className="text-sm text-slate-600">Checking instructor access...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-700">Instructor access only.</p>
          <a href="/" className="mt-3 inline-flex text-xs uppercase tracking-wide text-cyan-700">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
