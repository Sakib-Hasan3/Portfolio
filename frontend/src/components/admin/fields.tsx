"use client";

import { ArrowDown, ArrowUp, FileText, ImagePlus, Plus, Trash, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategoryIcon } from "@/components/site/icons";
import { api, ApiError, upload } from "@/lib/admin/client";
import { ICON_OPTIONS } from "@/lib/admin/resources";
import type { PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Spinner, useToast } from "./ui";

export function FieldShell({ label, htmlFor, help, error, required, children, className }: {
  label: string; htmlFor?: string; help?: string; error?: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : help ? <p className="mt-1.5 text-xs text-faint">{help}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ tags
export function TagsInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };
  return (
    <div className="field flex min-h-[42px] flex-wrap items-center gap-1.5 !py-1.5">
      {value.map((t, i) => (
        <span key={t + i} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pl-2 pr-1 text-sm">
          {t}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${t}`} className="rounded p-0.5 text-faint hover:text-text">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-[15px] outline-none"
        placeholder={value.length ? "" : "Type and press Enter"}
      />
    </div>
  );
}

// ------------------------------------------------------------------ list (one per line)
export function ListInput({ id, value, onChange, rows = 4 }: { id: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current && value.join("\n") !== text.split("\n").map((s) => s.trim()).filter(Boolean).join("\n")) setText(value.join("\n"));
    last.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <textarea
      id={id}
      rows={Math.max(rows, Math.min(10, value.length + 1))}
      className="field resize-y"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const next = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
        last.current = next;
        onChange(next);
      }}
    />
  );
}

// ------------------------------------------------------------------ media
export function MediaField({ id, value, onChange, kind, purpose }: { id: string; value: string | null; onChange: (v: string | null) => void; kind: "image" | "pdf"; purpose: string }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const asset = await upload(file, purpose);
      onChange(asset.url);
      toast("success", `${kind === "pdf" ? "PDF" : "Image"} uploaded`);
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-2">
        {value ? (
          kind === "image" ? <img src={value} alt="" className="size-full object-cover" /> : (
            <a href={value} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-xs text-muted hover:text-text">
              <FileText className="size-8" /> Open PDF
            </a>
          )
        ) : kind === "image" ? <ImagePlus className="size-7 text-faint" /> : <FileText className="size-7 text-faint" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Spinner /> : <Upload className="size-4" />} {value ? "Replace" : "Upload"} {kind === "pdf" ? "PDF" : "image"}
          </button>
          {value && (
            <button type="button" className="btn btn-quiet !py-1.5 text-sm" onClick={() => onChange(null)}>Remove</button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept={kind === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp,image/gif"}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <input id={id} className="field !text-sm" placeholder="…or paste a URL" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
        <p className="text-xs text-faint">{kind === "pdf" ? "PDF up to 15 MB." : "JPEG, PNG, WebP or GIF up to 5 MB."}</p>
      </div>
    </div>
  );
}

type GalleryItem = { url: string; caption?: string | null };

export function GalleryField({ value, onChange, purpose }: { value: GalleryItem[]; onChange: (v: GalleryItem[]) => void; purpose: string }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const next = [...value];
    for (const f of Array.from(files)) {
      try {
        const a = await upload(f, purpose);
        next.push({ url: a.url, caption: "" });
      } catch (e) {
        toast("error", `${f.name}: ${e instanceof ApiError ? e.message : "upload failed"}`);
      }
    }
    onChange(next);
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  const move = (i: number, d: -1 | 1) => {
    const n = [...value];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 space-y-2">
          {value.map((img, i) => (
            <li key={img.url + i} className="flex items-center gap-3 rounded-lg border border-line p-2">
              <img src={img.url} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
              <input className="field !text-sm" placeholder="Caption (optional)" value={img.caption ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, caption: e.target.value } : v)))} />
              <div className="flex shrink-0">
                <button type="button" className="btn btn-quiet !p-1.5" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}><ArrowUp className="size-4" /></button>
                <button type="button" className="btn btn-quiet !p-1.5" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === value.length - 1}><ArrowDown className="size-4" /></button>
                <button type="button" className="btn btn-quiet !p-1.5 hover:!text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove screenshot"><Trash className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Spinner /> : <ImagePlus className="size-4" />} Add screenshots
      </button>
      <input ref={input} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => addFiles(e.target.files)} />
    </div>
  );
}

// ------------------------------------------------------------------ links
type LinkItem = { label: string; url: string };
export function LinksField({ value, onChange }: { value: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input className="field !w-2/5" placeholder="Label" value={l.label} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))} />
          <input className="field" placeholder="https://" value={l.url} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, url: e.target.value } : v)))} />
          <button type="button" className="btn btn-quiet !p-2 hover:!text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove link"><Trash className="size-4" /></button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => onChange([...value, { label: "", url: "" }])}>
        <Plus className="size-4" /> Add link
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ relation
export function useOptions(resource: string | null, labelKey: string) {
  const [opts, setOpts] = useState<{ value: string; label: string }[] | null>(null);
  useEffect(() => {
    if (!resource) return;
    let alive = true;
    api<PageResult<Record<string, unknown>>>(`/admin/${resource}`, { query: { page_size: 200 } })
      .then((r) => alive && setOpts(r.items.map((i) => ({ value: String(i.id), label: String(i[labelKey] ?? `#${i.id}`) }))))
      .catch(() => alive && setOpts([]));
    return () => {
      alive = false;
    };
  }, [resource, labelKey]);
  return opts;
}

export function RelationSelect({ id, value, onChange, resource, labelKey, required, invalid }: {
  id: string; value: number | null; onChange: (v: number | null) => void; resource: string; labelKey: string; required?: boolean; invalid?: boolean;
}) {
  const opts = useOptions(resource, labelKey);
  return (
    <select id={id} className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} aria-invalid={invalid}>
      <option value="">{opts === null ? "Loading…" : required ? "Choose…" : "None"}</option>
      {opts?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ------------------------------------------------------------------ icon
export function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
      {ICON_OPTIONS.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          title={name}
          onClick={() => onChange(value === name ? null : name)}
          className={cn("grid size-9 place-items-center rounded-lg border transition-colors", value === name ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-text")}
        >
          <CategoryIcon name={name} className="size-4" />
        </button>
      ))}
    </div>
  );
}
