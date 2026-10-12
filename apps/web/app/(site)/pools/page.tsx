import type { Metadata } from "next";
import { PoolsMarketplace } from "./marketplace";

export const metadata: Metadata = { title: "Pools" };

export default function PoolsPage() {
  return <PoolsMarketplace />;
}
