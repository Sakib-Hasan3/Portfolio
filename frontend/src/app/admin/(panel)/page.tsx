"use client";

import { Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell";
import { Card, PageHeader } from "@/components/admin/ui";
import { api } from "@/lib/admin/client";

type Counts = { total: number; published: number; draft: number };
type Stats = {
  content: Record<string, Counts>;
  messages: { total: number; unread: number; by_day: { date: string; count: number }[] };
  featured_projects: number;
};
type Activity = { id: number; action: string; entity_type: string; entity_id: number | null; summary: string; created_at: string };

const MODULES: { key: string; label: string; href: string }[] = [
  { key: "projects", label: "Projects", href: "/admin/projects" },
  { key: "publications", label: "Publications", href: "/admin/publications" },
  { key: "skills", label: "Skills", href: "/admin/skills" },
  { key: "experience", label: "Experience", href: "/admin/experience" },
  { key: "education", label: "Education", href: "/admin/education" },
  { key: "achievements", label: "Achievements", href: "/admin/achievements" },
];

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const { user } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);

  useEffect(() => {
    api<Stats>("/admin/dashboard/stats").then(setStats).catch(() => {});
    api<Activity[]>("/admin/dashboard/activity", { query: { limit: 12 } }).then(setActivity).catch(() => setActivity([]));
  }, []);

  const first = user?.full_name.split(" ")[0];

  return (
    <div>
      <PageHeader
        title={first ? `Welcome back, ${first}` : "Overview"}
        description="What's on your portfolio right now. Changes you publish show up on the public site within seconds."
        actions={
          <>
            <Link href="/admin/projects/new" className="btn btn-primary"><Plus className="size-4" /> New project</Link>
          </>
        }
      />

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
        {[
          { label: "Projects", value: stats?.content.projects.total, href: "/admin/projects" },
          { label: "Publications", value: stats?.content.publications.total, href: "/admin/publications" },
          { label: "Skills", value: stats?.content.skills.total, href: "/admin/skills" },
          { label: "Experience", value: stats?.content.experience.total, href: "/admin/experience" },
          { label: "Messages", value: stats?.messages.total, href: "/admin/messages", note: stats?.messages.unread ? `${stats.messages.unread} unread` : undefined },
        ].map((t) => (
          <Link key={t.label} href={t.href} className="bg-surface p-5 transition-colors hover:bg-surface-2">
            <p className="text-sm text-muted">{t.label}</p>
            {t.value === undefined ? <div className="skeleton mt-2 h-8 w-12" /> : <p className="mt-1 font-display text-3xl font-semibold">{t.value}</p>}
            {t.note && <p className="mt-1 text-xs text-accent">{t.note}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-sans text-base font-semibold tracking-normal">Published vs draft</h2>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-1" /> Published</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-empty" /> Draft</span>
            </div>
          </div>
          {stats ? <PublishChart stats={stats} /> : <div className="skeleton mt-6 h-48" />}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-sans text-base font-semibold tracking-normal">Contact messages, last 14 days</h2>
          {stats ? <MessagesChart days={stats.messages.by_day} /> : <div className="skeleton mt-6 h-40" />}
          {stats && stats.messages.unread > 0 && (
            <Link href="/admin/messages?status=new" className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:underline">
              <Inbox className="size-4" /> Read {stats.messages.unread} new {stats.messages.unread === 1 ? "message" : "messages"}
            </Link>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="border-b border-line px-6 py-4 font-sans text-base font-semibold tracking-normal">Recent activity</h2>
        {activity === null ? (
          <div className="space-y-3 p-6">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-4 w-2/3" />)}</div>
        ) : activity.length === 0 ? (
          <p className="p-6 text-sm text-muted">Nothing yet. Edits, uploads and sign-ins will be listed here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-6 py-3 text-sm">
                <span className={`size-1.5 shrink-0 rounded-full ${a.action === "delete" ? "bg-danger" : a.action === "security" ? "bg-[#d9a13b]" : "bg-chart-1"}`} aria-hidden />
                <span className="flex-1">{a.summary}</span>
                <time className="shrink-0 text-xs text-faint" dateTime={a.created_at}>{timeAgo(a.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PublishChart({ stats }: { stats: Stats }) {
  const rows = MODULES.map((m) => ({ ...m, ...(stats.content[m.key] ?? { total: 0, published: 0, draft: 0 }) }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <table className="sr-only">
        <caption>Published and draft items per section</caption>
        <thead><tr><th>Section</th><th>Published</th><th>Draft</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key}><td>{r.label}</td><td>{r.published}</td><td>{r.draft}</td></tr>)}</tbody>
      </table>
      <ul className="space-y-3" aria-hidden>
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={r.href} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm" onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}>
              <span className="text-muted">{r.label}</span>
              <span className="relative flex h-3 gap-[2px]">
                {r.total === 0 ? (
                  <span className="h-full w-full rounded border border-dashed border-line" />
                ) : (
                  <>
                    {r.published > 0 && <span className="h-full rounded-[4px] bg-chart-1" style={{ width: `${(r.published / max) * 100}%` }} />}
                    {r.draft > 0 && <span className="h-full rounded-[4px] bg-chart-empty" style={{ width: `${(r.draft / max) * 100}%` }} />}
                  </>
                )}
                {hover === r.key && (
                  <span className="absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-[var(--shadow)]">
                    {r.published} published, {r.draft} draft
                  </span>
                )}
              </span>
              <span className="text-right tabular-nums text-muted">{r.published}/{r.total}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessagesChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const [hover, setHover] = useState<number | null>(null);
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="mt-6">
      <p className="text-sm text-muted"><span className="font-display text-2xl font-semibold text-text">{total}</span> in two weeks</p>
      <div className="relative mt-4 flex h-28 items-end gap-[2px] border-b border-line" role="img" aria-label={`${total} messages in the last 14 days`}>
        {days.map((d, i) => (
          <div key={d.date} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div
              className={`w-full rounded-t-[4px] ${d.count ? "bg-chart-2" : "bg-transparent"} ${hover === i ? "opacity-80" : ""}`}
              style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : 0 }}
            />
            {hover === i && (
              <span className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-[var(--shadow)]">
                {fmt(d.date)}: {d.count}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-faint">
        <span>{fmt(days[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
