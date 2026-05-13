import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lehrplan-Tagger",
  description: "Initiales Grundgerüst für Lehrplan-Tagging.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
