/**
 * Same-origin fetch client. next.config.ts rewrites /api/* to the FastAPI app,
 * so the httpOnly session cookie is first-party. Mutations carry X-Credent: 1
 * (the API's CSRF guard). Errors arrive as JSON {code, message}.
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method: Method = opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (method !== "GET") headers["X-Credent"] = "1";

  const url = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, credentials: "include", cache: "no-store", signal: opts.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("NETWORK", "Can't reach the Credent API. Check that it's running and try again.", 0);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A dev-server rewrite to a stopped API surfaces as a 500 with no JSON body.
    if (!data && res.status >= 500) {
      throw new ApiError("UNAVAILABLE", "The Credent API isn't responding right now.", res.status);
    }
    throw new ApiError(
      data?.code ?? "HTTP_ERROR",
      data?.message ?? data?.detail ?? `Request failed (HTTP ${res.status}).`,
      res.status,
    );
  }
  return data as T;
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export function isUnavailable(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "NETWORK" || e.code === "UNAVAILABLE");
}
