import { Cursor } from "@/components/site/cursor";
import { SiteFooter } from "@/components/site/footer";
import { SiteNav } from "@/components/site/nav";
import { SmoothScroll } from "@/components/site/smooth-scroll";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain relative min-h-dvh overflow-x-clip">
      <SmoothScroll />
      <Cursor />
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
