"use client";

import { CircleCheck, FileText, Trash, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, PageHeader, Spinner, useConfirm, useToast } from "@/components/admin/ui";
import { api, ApiError, upload } from "@/lib/admin/client";
import type { PageResult } from "@/lib/types";

type Resume = { id: number; title: string; file_url: string; media_asset_id: number | null; is_active: boolean; notes: string | null; created_at: string };

export default function ResumePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Resume[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PageResult<Resume>>("/admin/resumes", { query: { page_size: 100 } }).then((r) => setItems([...r.items].reverse())).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const asset = await upload(file, "resume");
      await api("/admin/resumes", {
        body: { title: title.trim() || file.name.replace(/\.pdf$/i, ""), file_url: asset.url, media_asset_id: asset.id, is_active: true },
      });
      toast("success", "CV uploaded — the Download CV button now serves it");
      setTitle("");
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const activate = async (r: Resume) => {
    try {
      await api(`/admin/resumes/${r.id}`, { method: "PATCH", body: { is_active: true } });
      toast("success", `“${r.title}” is now the public CV`);
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not update");
    }
  };

  const remove = async (r: Resume) => {
    if (!(await confirm({ title: `Delete “${r.title}”?`, body: r.is_active ? "This is your public CV. The Download CV button will disappear until another one is active." : "The file stays in the media library.", confirm: "Delete", danger: true }))) return;
    try {
      await api(`/admin/resumes/${r.id}`, { method: "DELETE" });
      toast("success", "Deleted");
      load();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not delete");
    }
  };

  return (
    <div>
      <PageHeader title="CV / resume" description="Upload a PDF and choose which version the Download CV buttons serve. Older versions are kept so you can switch back." />
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="label">Version name (optional)</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CV — November 2026" />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Spinner /> : <Upload className="size-4" />} Upload PDF
          </button>
          <input ref={input} type="file" hidden accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <p className="mt-2 text-xs text-faint">PDF up to 15 MB. A new upload becomes the active CV.</p>
      </Card>

      <Card className="mt-6">
        {items === null ? (
          <div className="p-6"><div className="skeleton h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No CV uploaded yet. Upload one and the Download CV button appears on the site.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <FileText className="size-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.title} {r.is_active && <Badge tone="ok">Public</Badge>}</p>
                  <p className="text-xs text-faint">Uploaded {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet text-sm">Open</a>
                {!r.is_active && (
                  <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => activate(r)}>
                    <CircleCheck className="size-4" /> Make public
                  </button>
                )}
                <button type="button" className="btn btn-quiet !p-2 hover:!text-danger" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}><Trash className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
