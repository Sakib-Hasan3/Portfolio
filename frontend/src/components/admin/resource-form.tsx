"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/admin/client";
import type { FieldDef, ResourceDef } from "@/lib/admin/resources";
import { cn } from "@/lib/utils";
import { FieldShell, GalleryField, IconPicker, LinksField, ListInput, MarkdownField, MediaField, RelationSelect, TagsInput } from "./fields";
import { Card, PageHeader, Spinner, Switch, useToast } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Values = Record<string, any>;

const URL_RE = /^(https?:\/\/\S+|\/uploads\/\S+)$/i;
const toNum = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : Number(v));

export function fieldSchema(f: FieldDef): z.ZodType {
  const req = `${f.label} is required`;
  switch (f.type) {
    case "number": {
      let n = z.number({ error: `${f.label} must be a number` }).int(`${f.label} must be a whole number`);
      if (f.min !== undefined) n = n.min(f.min, `${f.label} must be at least ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `${f.label} must be at most ${f.max}`);
      return z.preprocess(toNum, f.required ? n : n.nullable());
    }
    case "relation":
      return z.preprocess(toNum, f.required ? z.number({ error: req }) : z.number().nullable());
    case "boolean":
      return z.boolean();
    case "tags":
    case "list":
      return z.array(z.string());
    case "links":
      return z.array(z.object({ label: z.string().trim().min(1, "Each link needs a label"), url: z.string().regex(URL_RE, "Links must start with https://") }));
    case "gallery":
      return z.array(z.object({ url: z.string(), caption: z.string().nullable().optional() }));
    case "image":
    case "pdf":
    case "url":
      return z
        .string()
        .nullable()
        .optional()
        .refine((v) => !v || URL_RE.test(v.trim()), "Enter a full URL starting with https://");
    case "slug":
      return z.string().max(200).regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Use lowercase letters, numbers and hyphens").nullable().optional();
    default: {
      let s = z.string().trim();
      if (f.maxLength) s = s.max(f.maxLength, `${f.label} must be at most ${f.maxLength} characters`);
      if (f.required) return s.min(1, req);
      return s.nullable().optional();
    }
  }
}

function emptyValue(f: FieldDef): unknown {
  if (f.defaultValue !== undefined) return f.defaultValue;
  if (["tags", "list", "links", "gallery"].includes(f.type)) return [];
  if (f.type === "boolean") return false;
  if (["number", "relation", "image", "pdf"].includes(f.type)) return null;
  return "";
}

export function initialValues(def: { fields: FieldDef[] }, item?: Values | null): Values {
  const out: Values = {};
  for (const f of def.fields) {
    const v = item?.[f.name];
    if (f.type === "gallery") out[f.name] = (v ?? []).map((i: any) => ({ url: i.url, caption: i.caption ?? "" }));
    else out[f.name] = v === undefined || v === null ? (item ? (["tags", "list", "links", "gallery"].includes(f.type) ? [] : f.type === "boolean" ? false : ["number", "relation", "image", "pdf"].includes(f.type) ? null : "") : emptyValue(f)) : v;
  }
  return out;
}

export function ResourceForm({ def, item }: { def: ResourceDef; item?: Values | null }) {
  const router = useRouter();
  const toast = useToast();
  const schema = useMemo(() => z.object(Object.fromEntries(def.fields.map((f) => [f.name, fieldSchema(f)]))), [def]);
  const form = useForm<Values>({ resolver: zodResolver(schema as any) as any, defaultValues: initialValues(def, item), mode: "onTouched" });
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting, isDirty } } = form;
  const isEdit = !!item?.id;

  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const f of def.fields) {
      const key = f.section ?? "Details";
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return [...map.entries()];
  }, [def]);

  const onSubmit = async (values: Values) => {
    const payload: Values = {};
    for (const f of def.fields) {
      let v = values[f.name];
      if (typeof v === "string") v = v.trim();
      if (v === "" && !f.required) v = null;
      payload[f.name] = v;
    }
    try {
      const saved = await api<Values>(isEdit ? `/admin/${def.name}/${item!.id}` : `/admin/${def.name}`, { method: isEdit ? "PATCH" : "POST", body: payload });
      toast("success", isEdit ? `${def.label} saved` : `${def.label} created`);
      router.push(isEdit ? `/admin/${def.name}` : `/admin/${def.name}/${saved.id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        let mapped = false;
        for (const err of e.errors) {
          const key = err.field.split(".")[0];
          if (def.fields.some((f) => f.name === key)) {
            setError(key, { message: err.message });
            mapped = true;
          }
        }
        toast("error", mapped ? "Some fields need attention." : e.message);
      } else toast("error", "Could not save. Check your connection and try again.");
    }
  };

  const title = isEdit ? `Edit ${def.label.toLowerCase()}` : `New ${def.label.toLowerCase()}`;
  const publicHref = isEdit && def.name === "projects" && item?.slug && item?.is_published ? `/projects/${item.slug}` : isEdit && def.name === "publications" && item?.slug && item?.is_published ? `/research/${item.slug}` : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Link href={`/admin/${def.name}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> {def.plural}
      </Link>
      <PageHeader
        title={title}
        description={isEdit ? String(item?.[def.titleKey] ?? "") : def.description}
        actions={publicHref ? <a href={publicHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm"><Eye className="size-4" /> View on site</a> : undefined}
      />

      <div className="space-y-6 pb-24">
        {sections.map(([name, fields]) => (
          <Card key={name} className="p-6">
            {sections.length > 1 && <h2 className="mb-5 font-sans text-sm font-semibold tracking-normal text-muted">{name}</h2>}
            <div className="grid gap-5 md:grid-cols-2">
              {fields.map((f) => {
                const id = `f-${f.name}`;
                const err = (errors[f.name]?.message as string | undefined) ?? (Array.isArray(errors[f.name]) ? "Check the entries above" : undefined);
                const span = f.span === 2 || ["textarea", "markdown", "list", "tags", "gallery", "links", "image", "pdf", "icon"].includes(f.type) ? "md:col-span-2" : "";
                if (f.type === "boolean") {
                  return (
                    <Controller key={f.name} name={f.name} control={control} render={({ field }) => (
                      <div className={cn("flex items-start justify-between gap-4 rounded-lg border border-line p-4", span)}>
                        <div>
                          <p className="text-sm font-medium">{f.label}</p>
                          {f.help && <p className="mt-0.5 text-xs text-faint">{f.help}</p>}
                        </div>
                        <Switch checked={!!field.value} onChange={field.onChange} label={f.label} />
                      </div>
                    )} />
                  );
                }
                return (
                  <FieldShell key={f.name} label={f.label} htmlFor={id} help={f.help} error={err} required={f.required} className={span}>
                    {renderInput(f, id, register, control, !!err)}
                  </FieldShell>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-6 py-3">
          {isDirty && <span className="mr-auto text-sm text-faint">Unsaved changes</span>}
          <Link href={`/admin/${def.name}`} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} {isEdit ? "Save changes" : `Create ${def.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </form>
  );
}

export function renderInput(f: FieldDef, id: string, register: any, control: any, invalid: boolean) {
  switch (f.type) {
    case "markdown":
      return <Controller name={f.name} control={control} render={({ field }) => <MarkdownField id={id} value={field.value ?? ""} onChange={field.onChange} rows={f.rows ?? 14} maxLength={f.maxLength ?? 20000} invalid={invalid} />} />;
    case "textarea":
      return <textarea id={id} rows={f.rows ?? 4} className="field resize-y" aria-invalid={invalid} {...register(f.name)} />;
    case "number":
      return <input id={id} type="number" inputMode="numeric" className="field" aria-invalid={invalid} min={f.min} max={f.max} {...register(f.name)} />;
    case "select":
      return (
        <select id={id} className="field" aria-invalid={invalid} {...register(f.name)}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "tags":
      return <Controller name={f.name} control={control} render={({ field }) => <TagsInput id={id} value={field.value ?? []} onChange={field.onChange} />} />;
    case "list":
      return <Controller name={f.name} control={control} render={({ field }) => <ListInput id={id} value={field.value ?? []} onChange={field.onChange} />} />;
    case "image":
    case "pdf":
      return <Controller name={f.name} control={control} render={({ field }) => <MediaField id={id} value={field.value} onChange={field.onChange} kind={f.type as "image" | "pdf"} purpose={f.purpose ?? "misc"} />} />;
    case "gallery":
      return <Controller name={f.name} control={control} render={({ field }) => <GalleryField value={field.value ?? []} onChange={field.onChange} purpose={f.purpose ?? "misc"} />} />;
    case "links":
      return <Controller name={f.name} control={control} render={({ field }) => <LinksField value={field.value ?? []} onChange={field.onChange} />} />;
    case "relation":
      return <Controller name={f.name} control={control} render={({ field }) => <RelationSelect id={id} value={field.value} onChange={field.onChange} resource={f.relation!.resource} labelKey={f.relation!.labelKey} required={f.required} invalid={invalid} />} />;
    case "icon":
      return <Controller name={f.name} control={control} render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />} />;
    case "url":
      return <input id={id} type="url" className="field" placeholder="https://" aria-invalid={invalid} {...register(f.name)} />;
    default:
      return <input id={id} type="text" className="field" placeholder={f.placeholder} maxLength={f.maxLength} aria-invalid={invalid} {...register(f.name)} />;
  }
}
