import type { Metadata } from "next";
import { Nunito_Sans, JetBrains_Mono } from "next/font/google";
import MobileNav from "@/components/MobileNav";
import VercelAnalytics from "@/components/VercelAnalytics";
import ClientProviders from "@/providers/ClientProviders";
import { buildDefaultMetadata } from "@/lib/metadata";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-sans",
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
    <html lang="en" className={`${nunitoSans.variable} ${jetbrains.variable}`}>
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
