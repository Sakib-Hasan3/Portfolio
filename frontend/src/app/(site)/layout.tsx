import Script from "next/script";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { CursorGlow, ScrollProgress } from "@/components/site/site-effects";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader, type NavItem } from "@/components/site/header";
import { getPortfolioSafe } from "@/lib/api/server";
import { getT } from "@/lib/i18n-server";
import { isVisible } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [data, { t }] = await Promise.all([getPortfolioSafe(), getT()]);
  const name = data?.profile?.full_name || "Portfolio";
  const vis = data?.settings?.section_visibility;

  const nav: NavItem[] = [];
  if (data?.profile?.about_summary && isVisible(vis, "about")) nav.push({ href: "/#about", label: t("nav.about") });
  if (data?.publications.length && isVisible(vis, "research")) nav.push({ href: "/research", label: t("nav.research") });
  if (data?.projects.length && isVisible(vis, "projects")) nav.push({ href: "/projects", label: t("nav.projects") });
  if (data?.notes?.length && isVisible(vis, "notes")) nav.push({ href: "/notes", label: t("nav.notes") });
  if (data?.experience.length && isVisible(vis, "experience")) nav.push({ href: "/#experience", label: t("nav.experience") });
  if (isVisible(vis, "contact")) nav.push({ href: "/#contact", label: t("nav.contact") });

  const s = data?.settings;
  return (
    <>
      <CursorGlow />
      <ScrollProgress />
      <SiteHeader name={name} nav={nav} resumeUrl={data?.resume?.file_url} />
      <main id="main">{children}</main>
      <AssistantWidget />
      <SiteFooter name={name} text={s?.footer_text} links={data?.social_links ?? []} />
      {s?.analytics_provider === "plausible" && s.analytics_site_id ? (
        <Script defer data-domain={s.analytics_site_id} src={s.analytics_script_url || "https://plausible.io/js/script.js"} strategy="afterInteractive" />
      ) : null}
      {s?.analytics_provider === "umami" && s.analytics_site_id ? (
        <Script defer data-website-id={s.analytics_site_id} data-do-not-track="true" src={s.analytics_script_url || "https://cloud.umami.is/script.js"} strategy="afterInteractive" />
      ) : null}
    </>
  );
}
