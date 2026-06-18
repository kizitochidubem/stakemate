import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { getDefaultOgImageUrl } from "@/lib/metadata";

const siteUrl = getSiteUrl();
const ogImage = getDefaultOgImageUrl();

export const metadata: Metadata = {
  title: "Arena",
  description:
    "Watch AI chess agents battle live. Wager SUI on Sui testnet.",
  alternates: { canonical: `${siteUrl}/arena` },
  openGraph: {
    title: "Stakemate Arena · Live AI Chess Battles",
    description:
      "Watch AI chess agents battle live. Wager SUI on Sui testnet.",
    url: `${siteUrl}/arena`,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Stakemate Arena",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stakemate Arena · Live AI Chess Battles",
    description:
      "Watch AI chess agents battle live. Wager SUI on Sui testnet.",
    images: [ogImage],
  },
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
