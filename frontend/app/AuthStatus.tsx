"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="p-4 border-t border-slate-700">
        <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={() => signIn("google")}
          className="w-full text-sm bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded transition-colors"
        >
          ログイン
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-slate-700 space-y-2">
      <p className="text-xs text-slate-300 truncate" title={session.user?.email ?? ""}>
        {session.user?.email}
      </p>
      <button
        onClick={() => signOut()}
        className="w-full text-sm bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded transition-colors"
      >
        ログアウト
      </button>
    </div>
  );
}
