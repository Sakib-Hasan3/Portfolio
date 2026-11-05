"use client";

import { Copy, FileText, Trash, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, PageHeader, Spinner, useConfirm, useToast } from "@/components/admin/ui";
import { api, ApiError, upload } from "@/lib/admin/client";
import type { PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Asset = { id: number; url: string; kind: string; mime_type: string; size_bytes: number; original_filename: string | null; width: number | null; height: number | null; purpose: string | null; created_at: string };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default function MediaPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"" | "image" | "pdf">("");
  const [data, setData] = useState<PageResult<Asset> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PageResult<Asset>>("/admin/media", { query: { kind: kind || undefined, page_size: 120 } }).then(setData).catch(() => setData({ items: [], total: 0, page: 1, page_size: 120 }));
  }, [kind]);
  useEffect(load, [load]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        await upload(f, "misc");
      } catch (e) {
        toast("error", `${f.name}: ${e instanceof ApiError ? e.message : "upload failed"}`);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    toast("success", "Upload finished");
    load();
  };

  const copy = async (a: Asset) => {
    const url = a.url.startsWith("http") ? a.url : `${window.location.origin}${a.url}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "URL copied");
    } catch {
      toast("error", "Couldn't access the clipboard");
    }
  };

  const remove = async (a: Asset) => {
    if (!(await confirm({ title: "Delete this file?", body: "Anything still using its URL (a project thumbnail, a CV) will show a broken link.", confirm: "Delete file", danger: true }))) return;
    try {
      await api(`/admin/media/${a.id}`, { method: "DELETE" });
      toast("success", "File deleted");
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not delete");
    }
  };

  return (
    <div>
      <PageHeader
        title="Media library"
        description="Every image and PDF you've uploaded. Files are type-checked by content and size-limited on the server."
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Spinner /> : <Upload className="size-4" />} Upload files</button>
            <input ref={input} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(e) => onFiles(e.target.files)} />
          </>
        }
      />
      <div className="mb-4 flex gap-1">
        {([["", "All"], ["image", "Images"], ["pdf", "PDFs"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-lg px-3 py-1.5 text-sm", kind === k ? "bg-surface-2 font-medium" : "text-muted hover:text-text")}>{l}</button>
        ))}
      </div>
      {!data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-square" />)}</div>
      ) : data.items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted">No files yet.</Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data.items.map((a) => (
            <li key={a.id}>
              <Card className="group overflow-hidden">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-surface-2">
                  {a.kind === "image" ? <img src={a.url} alt={a.original_filename ?? ""} loading="lazy" className="size-full object-cover" /> : (
                    <span className="grid size-full place-items-center text-muted"><FileText className="size-10" /></span>
                  )}
                </a>
                <div className="p-3">
                  <p className="truncate text-sm font-medium" title={a.original_filename ?? ""}>{a.original_filename ?? "Untitled"}</p>
                  <p className="text-xs text-faint">{kb(a.size_bytes)}{a.width ? ` — ${a.width}×${a.height}` : ""}{a.purpose ? ` — ${a.purpose}` : ""}</p>
                  <div className="mt-2 flex gap-1">
                    <button type="button" className="btn btn-quiet !px-1.5 !py-1 text-xs" onClick={() => copy(a)}><Copy className="size-3.5" /> Copy URL</button>
                    <button type="button" className="btn btn-quiet ml-auto !px-1.5 !py-1 hover:!text-danger" onClick={() => remove(a)} aria-label="Delete file"><Trash className="size-3.5" /></button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
