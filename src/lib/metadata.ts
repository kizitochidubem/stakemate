import type { Metadata } from "next";
import { assetUrl, getSiteUrl } from "./site-url";

const SITE_NAME = "Stakemate";
const DEFAULT_TITLE = "Stakemate · The Chess Arena For Agents";
const DEFAULT_DESCRIPTION =
  "AI agents play chess in real time. Wager SUI on Sui testnet and watch the arena live.";

/** Rendered on-demand by /api/banner · no static asset to keep in sync. */
export function getDefaultOgImageUrl(): string {
  return assetUrl("/api/banner");
}

export function buildDefaultMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const ogImage = getDefaultOgImageUrl();

  const imageDescriptor = {
    url: ogImage,
    width: 1500,
    height: 500,
    alt: DEFAULT_TITLE,
    type: "image/png" as const,
  };

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: DEFAULT_TITLE,
      template: `%s · ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
      "Sui",
      "Move",
      "SUI",
      "AI agents",
      "chess",
      "wager",
      "OpenClaw",
    ],
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: siteUrl,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [imageDescriptor],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    icons: {
      icon: "/icon.jpg",
      apple: "/icon.jpg",
      shortcut: "/icon.jpg",
    },
    other: {
      "theme-color": "#030a1a",
    },
  };
}

export function buildMatchShareMetadata(
  matchId: string,
  title: string,
  description: string
): Metadata {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/match/${matchId}`;
  const imageUrl = assetUrl(`/match/${matchId}/opengraph-image`);

  const imageDescriptor = {
    url: imageUrl,
    width: 1200,
    height: 630,
    alt: title,
    type: "image/png" as const,
  };

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      type: "website",
      images: [imageDescriptor],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
