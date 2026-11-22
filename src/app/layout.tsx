import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../../launcher/crates/luminos-app/assets/fonts/Inter-Regular.otf", weight: "400" },
    { path: "../../launcher/crates/luminos-app/assets/fonts/Inter-Bold.otf", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const jb = localFont({
  src: "../../launcher/crates/luminos-app/assets/fonts/JetBrainsMono-Regular.ttf",
  variable: "--font-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Luminos Launcher — the Minecraft launcher, rebuilt in Rust",
  description:
    "A light, fast, open-source Minecraft launcher with a built-in mod library, auto-updating content, skin studio, playtime tracking and the optimised Luminos Client bundle.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jb.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
