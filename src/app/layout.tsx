import type { Metadata } from "next";
import { Geist, Manrope, JetBrains_Mono } from "next/font/google";
import MobileNav from "@/components/MobileNav";
import VercelAnalytics from "@/components/VercelAnalytics";
import ClientProviders from "@/providers/ClientProviders";
import { buildDefaultMetadata } from "@/lib/metadata";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = buildDefaultMetadata();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 64 }}>
        <ClientProviders>
          {children}
          <MobileNav />
        </ClientProviders>
        <VercelAnalytics />
      </body>
    </html>
  );
}
