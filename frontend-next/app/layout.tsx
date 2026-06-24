import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/AppProviders";
import "@/styles/app-shell.css";
import "@/styles/desktop-layout.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "OnTrack",
  description: "OnTrack — Next.js foundation (migration from CRA)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="antialiased">
        <div id="root" className="min-h-screen">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
