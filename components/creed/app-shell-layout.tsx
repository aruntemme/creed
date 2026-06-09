"use client";

import type { ReactNode } from "react";
import { CreedShell } from "@/components/creed/shell";
import { QualityToasts } from "@/components/creed/quality-toasts";
import { useCreed } from "@/components/creed/creed-provider";

export function AppShellLayout({ children }: { children: ReactNode }) {
  const { state } = useCreed();

  return (
    <>
      {/* Mounted at the shell so a completion toast fires regardless of which
          app page is open when the analysis finishes. */}
      <QualityToasts />
      <CreedShell
        userName={state.user.name}
        avatarInitials={state.user.avatarInitials}
        avatarUrl={state.user.avatarUrl}
        sections={state.sections}
      >
        {children}
      </CreedShell>
    </>
  );
}
