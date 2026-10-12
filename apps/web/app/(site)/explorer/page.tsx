import type { Metadata } from "next";
import { Explorer } from "./explorer";

export const metadata: Metadata = { title: "Explorer" };

export default function ExplorerPage() {
  return <Explorer />;
}
