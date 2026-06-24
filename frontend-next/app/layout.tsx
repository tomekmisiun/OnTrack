import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "OnTrack",
  description: "OnTrack — Next.js foundation (migration from CRA)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
