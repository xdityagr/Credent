"use client";

import { createContext, useContext } from "react";
import type { Me, Org } from "./types";

/** The signed-in, onboarded session inside /app. Provided by the app shell. */
const SessionCtx = createContext<Me | null>(null);

export const SessionProvider = SessionCtx.Provider;

export function useSession(): Me & { org: Org } {
  const me = useContext(SessionCtx);
  if (!me || !me.org) throw new Error("useSession must be used inside the /app shell");
  return me as Me & { org: Org };
}
