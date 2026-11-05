"use client";

import { ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Search, Trash } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/admin/client";
import type { FilterDef, ResourceDef } from "@/lib/admin/resources";
import type { PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOptions } from "./fields";
import { Badge, Card, PageHeader, Switch, useConfirm, useToast } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const PAGE_SIZE = 25;

export function ResourceList({ def }: { def: ResourceDef }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [trash, setTrash] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResult<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [debounced, filters, trash]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<PageResult<Row>>(`/admin/${def.name}`, { query: { q: debounced, page, page_size: PAGE_SIZE, trash: trash || undefined, ...filters } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load items.");
    }
  }, [def.name, debounced, page, filters, trash]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePublish = async (row: Row) => {
    const next = !row.is_published;
    setData((d) => d && { ...d, items: d.items.map((r) => (r.id === row.id ? { ...r, is_published: next } : r)) });
    try {
      await api(`/admin/${def.name}/${row.id}/publish`, { method: "POST", query: { published: next } });
      toast("success", next ? "Published — it's live on the site" : "Unpublished — hidden from the site");
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not update");
      load();
    }
  };

  const remove = async (row: Row, hard = false) => {
    const name = row[def.titleKey];
    const ok = await confirm({
      title: hard ? `Delete “${name}” permanently?` : `Delete “${name}”?`,
      body: hard ? "This can't be undone." : def.softDelete ? "It moves to the trash and disappears from the site. You can restore it later." : "It disappears from the site. This can't be undone.",
      confirm: hard ? "Delete permanently" : "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/${def.name}/${row.id}`, { method: "DELETE", query: { hard: hard || undefined } });
      toast("success", hard ? "Deleted permanently" : def.softDelete ? "Moved to trash" : "Deleted");
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not delete");
    }
  };

  const restore = async (row: Row) => {
    try {
      await api(`/admin/${def.name}/${row.id}/restore`, { method: "POST" });
      toast("success", "Restored");
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not restore");
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasFilters = !!debounced || Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        title={def.plural}
        description={def.description}
        actions={!trash && (
          <Link href={`/admin/${def.name}/new`} className="btn btn-primary">
            <Plus className="size-4" /> New {def.label.toLowerCase()}
          </Link>
        )}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative flex-1 md:max-w-sm">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={def.searchPlaceholder} className="field !pl-9" />
        </label>
        <div className="flex flex-wrap gap-2">
          {def.filters.map((f) => (
            <FilterSelect key={f.name} def={f} value={filters[f.name] ?? ""} onChange={(v) => setFilters((s) => ({ ...s, [f.name]: v }))} />
          ))}
          {def.softDelete && (
            <button type="button" onClick={() => setTrash((t) => !t)} className={cn("btn !py-2 text-sm", trash ? "btn-primary" : "btn-ghost")}>
              <Trash className="size-4" /> {trash ? "Viewing trash" : "Trash"}
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <div className="p-10 text-center">
            <p className="text-danger">{error}</p>
            <button type="button" className="btn btn-ghost mt-4" onClick={load}>Try again</button>
          </div>
        ) : !data ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-4 w-1/5" /><div className="ml-auto skeleton h-5 w-9 rounded-full" /></div>
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">{trash ? "The trash is empty" : hasFilters ? "Nothing matches these filters" : `No ${def.plural.toLowerCase()} yet`}</p>
            <p className="mt-1 text-sm text-muted">
              {trash ? "Deleted items appear here until you remove them permanently." : hasFilters ? "Clear the search or filters to see everything." : `Add the first one and it will appear on the site once published.`}
            </p>
            {!trash && !hasFilters && (
              <Link href={`/admin/${def.name}/new`} className="btn btn-primary mt-5"><Plus className="size-4" /> New {def.label.toLowerCase()}</Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-faint">
                <tr>
                  {def.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-5 py-3 font-medium">{c.label}</th>)}
                  {def.publishable && !trash && <th className="px-5 py-3 font-medium">Published</th>}
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-2/60">
                    {def.columns.map((c, ci) => (
                      <td key={c.key} className={cn("px-5 py-3 align-middle", ci === 0 || c.key === def.titleKey ? "font-medium" : "text-muted")}>
                        <Cell row={row} col={c} def={def} trash={trash} />
                      </td>
                    ))}
                    {def.publishable && !trash && (
                      <td className="px-5 py-3">
                        <Switch checked={!!row.is_published} onChange={() => togglePublish(row)} label={`Published: ${row[def.titleKey]}`} />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {trash ? (
                        <>
                          <button type="button" className="btn btn-quiet !py-1 text-sm" onClick={() => restore(row)}><RotateCcw className="size-4" /> Restore</button>
                          <button type="button" className="btn btn-quiet !py-1 text-sm hover:!text-danger" onClick={() => remove(row, true)}>Delete permanently</button>
                        </>
                      ) : (
                        <>
                          <Link href={`/admin/${def.name}/${row.id}`} className="btn btn-quiet !py-1" aria-label={`Edit ${row[def.titleKey]}`}><Pencil className="size-4" /></Link>
                          <button type="button" className="btn btn-quiet !py-1 hover:!text-danger" onClick={() => remove(row)} aria-label={`Delete ${row[def.titleKey]}`}><Trash className="size-4" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{data.total} items</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost !p-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
            <span>Page {page} of {pages}</span>
            <button type="button" className="btn btn-ghost !p-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ row, col, def, trash }: { row: Row; col: ResourceDef["columns"][number]; def: ResourceDef; trash: boolean }) {
  const v = row[col.key];
  if (col.kind === "image") {
    return v ? <img src={v} alt="" className="h-9 w-14 rounded object-cover" /> : <div className="h-9 w-14 rounded bg-surface-2" />;
  }
  if (col.kind === "bool") return v ? <Badge tone="accent">Yes</Badge> : <span className="text-faint">—</span>;
  if (col.kind === "badge") return v ? <Badge>{String(v)}</Badge> : <span className="text-faint">—</span>;
  if (col.key === def.titleKey && !trash) {
    return (
      <Link href={`/admin/${def.name}/${row.id}`} className="line-clamp-2 max-w-md hover:text-accent">
        {String(v)}
        {def.publishable && !row.is_published && <span className="ml-2 align-middle"><Badge tone="warn">Draft</Badge></span>}
      </Link>
    );
  }
  if (v === null || v === undefined || v === "") return <span className="text-faint">—</span>;
  return <span className="line-clamp-1 max-w-xs">{String(v)}</span>;
}

function FilterSelect({ def, value, onChange }: { def: FilterDef; value: string; onChange: (v: string) => void }) {
  const relOpts = useOptionsMaybe(def);
  const opts = def.options ?? relOpts ?? [];
  return (
    <select className="field !w-auto !py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Filter by ${def.label}`}>
      <option value="">{def.label}: all</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function useOptionsMaybe(def: FilterDef) {
  return useOptions(def.relation?.resource ?? null, def.relation?.labelKey ?? "name");
}
