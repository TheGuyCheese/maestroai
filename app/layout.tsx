import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { ClerkProvider } from "@clerk/nextjs";
import NavBadge from "@/components/NavBadge";

export const metadata: Metadata = {
  title: "MaestroAI — AI Music Sheet Teacher",
  description: "Upload a music sheet and let AI agents teach you every instrument part.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap"
          />
        </head>
        <body className="antialiased">
          {/* ── Auth badge — fixed top-right, visible on all screens ── */}
          <NavBadge />

          <AppProvider>{children}</AppProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
