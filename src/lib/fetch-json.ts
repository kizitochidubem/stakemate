export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    let data: ApiErrorBody & T;
    try {
      data = (await res.json()) as ApiErrorBody & T;
    } catch {
      if (!res.ok) {
        throw new ApiClientError(`Request failed (${res.status})`, res.status);
      }
      throw new ApiClientError("Invalid response from server", 502);
    }

    if (!res.ok) {
      throw new ApiClientError(
        typeof data.error === "string" ? data.error : `Request failed (${res.status})`,
        res.status,
        data.code
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiClientError("Request timed out · try again", 408, "TIMEOUT");
    }
    throw new ApiClientError("Network error · check your connection", 0, "NETWORK");
  } finally {
    clearTimeout(timer);
  }
}
