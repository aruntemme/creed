import type { Metadata } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/creed/theme-provider";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import { getSiteUrl } from "@/lib/env";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  display: "swap",
  subsets: ["latin"],
  weight: "500",
  style: "normal",
});

// Share-card / search-result imagery.
//
// - `/search-preview.png` (public/) is what Google's rich results, Slack,
//   iMessage, LinkedIn, and Facebook fetch for the link preview.
// - `app/twitter-image.png` is picked up by Next's filesystem convention
//   and wired into `<meta name="twitter:image">` automatically - we
//   don't need to reference it here.
// - `app/favicon.ico` stays the browser-tab favicon via Next's
//   filesystem convention. We pin it explicitly under `icons.icon` so a
//   future `app/icon.png` doesn't silently take over and the search-
//   result favicon Google reads stays the same one users see in tabs.
const SITE_DESCRIPTION =
  "Creed is one personal context file that every AI reads before it answers. Written once, kept current by your agents, and portable across every tool you use.";

// `title.default` is the brand title used by any page that doesn't set its
// own (the root redirect and /home both fall back to it). `title.template`
// suffixes per-page titles, so individual pages set a bare title ("Pricing")
// and get "Pricing | Creed" automatically. A page that wants an exact title
// uses `title: { absolute: "..." }`.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Creed - the personal context file every AI reads",
    template: "%s | Creed",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    siteName: "Creed",
    title: "Creed - the personal context file every AI reads",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/search-preview.png",
        width: 1000,
        height: 1000,
        alt: "Creed. A universal AI context file.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creed - the personal context file every AI reads",
    description: SITE_DESCRIPTION,
    images: ["/search-preview.png"],
  },
};

// The root layout is intentionally static: it holds no user state, reads no
// cookies/headers, and renders no CreedProvider. That is what lets marketing
// pages prerender as a static shell so <Link> fully prefetches them and
// navigation is instant with no server round-trip. The user-specific work
// (Supabase session, loadCreedState, CreedProvider) lives in <AuthedProviders>,
// pulled in only by the layouts that need it (the app shell and onboarding).
export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <head>
        {/* Apply persisted theme before paint so dark mode doesn't flash.
            This is a server-rendered inline script - runs once during the
            initial HTML response, before React hydrates, so the dark-mode
            class is on <html> by the time anything else paints.
            `next/script` with strategy="beforeInteractive" was causing the
            page to hang in Next 16 dev. Inline <script> in <head> is the
            canonical no-flash pattern and works without ceremony. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('creed:theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
