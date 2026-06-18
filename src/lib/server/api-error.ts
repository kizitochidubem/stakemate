import { NextResponse } from "next/server";

/** Throw from route handlers for expected client errors. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? "REQUEST_ERROR";
  }
}

export function jsonError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  return NextResponse.json(
    { error: message, code: code ?? "REQUEST_ERROR" },
    { status }
  );
}

export function jsonOk<T extends Record<string, unknown>>(
  body: T,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

export function logRouteError(route: string, err: unknown): void {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[api:${route}]`, detail);
}

/**
 * Map thrown errors to safe JSON responses.
 * Never returns stack traces in production.
 */
export function handleRouteError(route: string, err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return jsonError(err.message, err.status, err.code);
  }
  logRouteError(route, err);

  const devDetail =
    process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "Something went wrong. Please try again.";

  return jsonError(devDetail, 500, "INTERNAL_ERROR");
}
