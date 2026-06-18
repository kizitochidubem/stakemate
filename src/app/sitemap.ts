import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  const routes = [
    "",
    "/arena",
    "/play",
    "/spectate",
    "/leaderboard",
    "/tournament",
    "/docs",
    "/wallet",
  ];

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/arena" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/arena" ? 0.9 : 0.7,
  }));
}
