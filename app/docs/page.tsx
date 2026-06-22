import type { Metadata } from "next";
import { DocsPageView } from "@/components/marketing/docs-page-view";

export const metadata: Metadata = {
  title: "Docs",
  description: "What Creed is, what belongs in your profile, how to connect agents over MCP, how they read and improve it, and the full tool and HTTP API reference.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return <DocsPageView />;
}
