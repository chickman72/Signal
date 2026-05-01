"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserAccountAction, updateUserAccountAction, resetUserPasswordAction } from "../actions/users";
import type { User } from "../types";

type UserManagerProps = {
  users: User[];
};

const initialState = { ok: true, message: "" };

export default function UserManager({ users }: UserManagerProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(createUserAccountAction, initialState);

  useEffect(() => {
    if (state.ok && state.message) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {users.length} accounts
        </span>
      </div>

      <form
        action={formAction}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto]"
      >
        <input
          name="displayName"
          placeholder="Username (optional)"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Temp password"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
          required
        />
        <select
          name="role"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none"
          defaultValue="student"
        >
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="administrator">Administrator</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Create
        </button>
      </form>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {state.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <div className="grid min-w-[900px] grid-cols-[1.2fr_1.4fr_1.6fr_0.7fr_0.7fr_0.5fr] gap-4 border-b border-slate-200 bg-white px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
          <span>Username</span>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Created</span>
          <span>Save</span>
        </div>
        {users.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No accounts yet.</div>
        ) : (
          users.map((user) => (
            <div key={user.username} className="border-b border-slate-200 last:border-b-0">
              <UserRow user={user} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function UserRow({ user }: { user: User }) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateUserAccountAction, initialState);
  const [passwordState, passwordAction] = useActionState(resetUserPasswordAction, initialState);
  const legacyName = user.username && user.email && user.username !== user.email ? user.username : "";
  const displayName = user.displayName ?? legacyName;

  useEffect(() => {
    if (state.ok && state.message) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <form
        action={formAction}
        className="grid min-w-[900px] grid-cols-[1.2fr_1.4fr_1.6fr_0.7fr_0.7fr_0.5fr] items-center gap-4 border-b border-slate-200 px-4 py-3 text-sm text-slate-800"
      >
        <span className="font-semibold text-slate-950">{user.username}</span>
        <input type="hidden" name="username" value={user.username} />
        <input
          name="displayName"
          defaultValue={displayName}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none"
        />
        <input
          name="email"
          type="email"
          defaultValue={user.email ?? ""}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none"
        />
      <select
        name="role"
        defaultValue={user.role ?? "student"}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none"
      >
        <option value="student">Student</option>
        <option value="instructor">Instructor</option>
        <option value="administrator">Administrator</option>
      </select>
        <span className="text-slate-600">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "n/a"}
        </span>
        <div className="flex flex-col gap-1 items-end">
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Save
          </button>
          {state.message ? (
            <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {state.message}
            </span>
          ) : null}
        </div>
      </form>
      <form
        action={passwordAction}
        className="grid min-w-[900px] grid-cols-[1.2fr_1.4fr_1.6fr_0.7fr_0.7fr_0.5fr] items-center gap-4 border-b border-slate-200 px-4 py-3 text-sm text-slate-800"
      >
        <span className="font-semibold text-slate-950">{user.username}</span>
        <span className="text-slate-500">Reset password</span>
        <input type="hidden" name="username" value={user.username} />
        <input
          name="password"
          type="password"
          placeholder="New password"
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none"
        />
        <span className="text-slate-400">—</span>
        <div className="flex flex-col gap-1 items-end">
          <button
            type="submit"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 hover:border-amber-400 hover:bg-amber-500/20"
          >
            Reset
          </button>
          {passwordState.message ? (
            <span className={`text-xs ${passwordState.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {passwordState.message}
            </span>
          ) : null}
        </div>
      </form>
    </>
  );
}
