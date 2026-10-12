"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, errorMessage } from "./api";
import { useLive } from "./live";

interface Result<T> {
  key: string;
  data: T | null;
  error: string | null;
  code: string | null;
}

/**
 * GET `path` and keep it fresh: refetches whenever the public ledger changes.
 * Pass `null` to skip. Keeps the previous data while refetching.
 */
export function useApi<T>(path: string | null, token?: string | null) {
  const { version } = useLive();
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: null, code: null });
  const seq = useRef(0);
  const key = `${path}|${token ?? ""}|${version}|${nonce}`;

  useEffect(() => {
    if (path === null) return;
    const mine = ++seq.current;
    api<T>(path, { token })
      .then((data) => {
        if (mine === seq.current) setResult({ key, data, error: null, code: null });
      })
      .catch((e) => {
        if (mine !== seq.current) return;
        setResult((r) => ({
          key,
          data: r.data,
          error: errorMessage(e),
          code: e instanceof ApiError ? e.code : null,
        }));
      });
  }, [path, token, key]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const loading = path !== null && result.key !== key;
  return { data: path === null ? null : result.data, error: result.error, code: result.code, loading, refresh };
}
