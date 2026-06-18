import { cookies } from "next/headers";

export const ADMIN_COOKIE = "stakemate_admin";

export function isAdminConfigured(): boolean {
  return Boolean(process.env.STAKEMATE_ADMIN_SECRET?.trim());
}

export function verifyAdminSecret(candidate: string | null | undefined): boolean {
  const secret = process.env.STAKEMATE_ADMIN_SECRET?.trim();
  if (!secret || !candidate) return false;
  return candidate === secret;
}

export async function isAdminSession(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return verifyAdminSecret(token);
}

export async function assertAdminRequest(): Promise<void> {
  const authorized = await isAdminSession();
  if (!authorized) {
    throw new AdminAuthError();
  }
}

export class AdminAuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AdminAuthError";
  }
}
