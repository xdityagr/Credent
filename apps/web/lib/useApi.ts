"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";
import { useLive } from "./live";

/**
 * GET `path` and keep it fresh: refetches whenever the public ledger changes.
 * Pass `null` to skip. Keeps the previous data while refetching.
 */
export function useApi<T>(path: string | null, token?: string | null, extraKey: unknown = null) {
  const { version } = useLive();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    api<T>(path, { token })
      .then((d) => {
        if (mine === seq.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => mine === seq.current && setError(errorMessage(e)))
      .finally(() => mine === seq.current && setLoading(false));
  }, [path, token, version, nonce, extraKey]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, refresh };
}
