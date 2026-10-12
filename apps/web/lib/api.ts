export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST";
  body?: unknown;
  form?: FormData;
  token?: string | null;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "NETWORK",
      `Can't reach the Credent API at ${API_URL}. Start it with scripts/dev.ps1.`,
      0,
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.code ?? "HTTP_ERROR",
      data?.message ?? `Request failed (HTTP ${res.status}).`,
      res.status,
    );
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
