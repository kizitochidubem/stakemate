export const CANONICAL_SITE_HOST = "stakemate.xyz";

export const ASSET_HOST = "stakemate.xyz";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  if (process.env.VERCEL_ENV === "production") {
    return `https://${CANONICAL_SITE_HOST}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return `https://${CANONICAL_SITE_HOST}`;
}

export function getAssetOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ASSET_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const site = getSiteUrl();
  try {
    const host = new URL(site).hostname;
    if (host === CANONICAL_SITE_HOST) {
      return `https://${ASSET_HOST}`;
    }
  } catch {
  }

  return site;
}

export function assetUrl(path: string): string {
  const origin = getAssetOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
