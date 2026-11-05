"use client";

import { Archive, Inbox, Mail, Search, ShieldCheck, Trash } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell";
import { Badge, Card, PageHeader, useConfirm, useToast } from "@/components/admin/ui";
import { api, ApiError } from "@/lib/admin/client";
import type { PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Msg = { id: number; name: string; email: string; subject: string; message: string; status: string; is_spam: boolean; created_at: string };

const TABS = [
  { key: "", label: "All" },
  { key: "new", label: "Unread" },
  { key: "replied", label: "Replied" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
];

function Messages() {
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshUnread } = useAdmin();
  const [tab, setTab] = useState(params.get("status") ?? "");
  const [q, setQ] = useState("");
  const [data, setData] = useState<PageResult<Msg> | null>(null);
  const [selected, setSelected] = useState<Msg | null>(null);

  const load = useCallback(() => {
    const query = tab === "spam" ? { spam: true, q } : { status: tab || undefined, spam: false, q };
    api<PageResult<Msg>>("/admin/messages", { query: { ...query, page_size: 100 } }).then(setData).catch(() => setData({ items: [], total: 0, page: 1, page_size: 100 }));
  }, [tab, q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const patch = async (m: Msg, body: Partial<Msg>, note?: string) => {
    try {
      const updated = await api<Msg>(`/admin/messages/${m.id}`, { method: "PATCH", body });
      setSelected(updated);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === m.id ? updated : x)) });
      refreshUnread();
      if (note) toast("success", note);
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not update");
    }
  };

  const open = (m: Msg) => {
    setSelected(m);
    if (m.status === "new") patch(m, { status: "read" });
  };

  const remove = async (m: Msg) => {
    if (!(await confirm({ title: "Delete this message?", body: `From ${m.name}. This can't be undone.`, confirm: "Delete", danger: true }))) return;
    try {
      await api(`/admin/messages/${m.id}`, { method: "DELETE" });
      setSelected(null);
      toast("success", "Message deleted");
      refreshUnread();
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not delete");
    }
  };

  return (
    <div>
      <PageHeader title="Messages" description="Everything sent through the contact form. Replying opens your email app." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => { setTab(t.key); setSelected(null); }}
              className={cn("rounded-lg px-3 py-1.5 text-sm", tab === t.key ? "bg-surface-2 font-medium" : "text-muted hover:text-text")}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="relative md:w-72">
          <span className="sr-only">Search messages</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input type="search" className="field !pl-9" placeholder="Search name, email or text" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-2">
          {!data ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : data.items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted"><Inbox className="mx-auto mb-3 size-6 text-faint" />No messages here.</div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {data.items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => open(m)} className={cn("block w-full px-5 py-3.5 text-left transition-colors hover:bg-surface-2/60", selected?.id === m.id && "bg-surface-2")}>
                    <div className="flex items-center gap-2">
                      {m.status === "new" && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                      <span className={cn("flex-1 truncate text-sm", m.status === "new" && "font-semibold")}>{m.name}</span>
                      <time className="shrink-0 text-xs text-faint">{new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
                    </div>
                    <p className="mt-0.5 truncate text-sm">{m.subject}</p>
                    <p className="truncate text-xs text-faint">{m.message}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-h-80 lg:col-span-3">
          {!selected ? (
            <div className="grid h-full min-h-80 place-items-center p-10 text-sm text-muted">Select a message to read it.</div>
          ) : (
            <article className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{selected.subject}</h2>
                  <p className="mt-1 text-sm text-muted">{selected.name} &lt;{selected.email}&gt;</p>
                  <p className="text-xs text-faint">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1.5">
                  {selected.is_spam && <Badge tone="danger">Spam</Badge>}
                  <Badge tone={selected.status === "replied" ? "ok" : selected.status === "new" ? "accent" : "neutral"}>{selected.status}</Badge>
                </div>
              </div>
              <p className="mt-6 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
                <a href={`mailto:${selected.email}?subject=${encodeURIComponent("Re: " + selected.subject)}`} className="btn btn-primary text-sm" onClick={() => patch(selected, { status: "replied" })}>
                  <Mail className="size-4" /> Reply by email
                </a>
                {selected.status !== "archived" && (
                  <button type="button" className="btn btn-ghost text-sm" onClick={() => patch(selected, { status: "archived" }, "Archived")}><Archive className="size-4" /> Archive</button>
                )}
                <button type="button" className="btn btn-ghost text-sm" onClick={() => patch(selected, { is_spam: !selected.is_spam }, selected.is_spam ? "Moved out of spam" : "Marked as spam")}>
                  <ShieldCheck className="size-4" /> {selected.is_spam ? "Not spam" : "Mark as spam"}
                </button>
                {selected.status !== "new" && (
                  <button type="button" className="btn btn-quiet text-sm" onClick={() => patch(selected, { status: "new" }, "Marked as unread")}>Mark unread</button>
                )}
                <button type="button" className="btn btn-quiet ml-auto text-sm hover:!text-danger" onClick={() => remove(selected)}><Trash className="size-4" /> Delete</button>
              </div>
            </article>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><Messages /></Suspense>;
}
