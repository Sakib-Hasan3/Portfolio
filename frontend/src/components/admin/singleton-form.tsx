"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/admin/client";
import { SECTIONS, type FieldDef } from "@/lib/admin/resources";
import { cn } from "@/lib/utils";
import { FieldShell } from "./fields";
import { fieldSchema, initialValues, renderInput } from "./resource-form";
import { Card, PageHeader, Spinner, Switch, useToast } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Values = Record<string, any>;

export function SingletonForm({ endpoint, title, description, fields, successText }: {
  endpoint: string; title: string; description: string; fields: FieldDef[]; successText: string;
}) {
  const [item, setItem] = useState<Values | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Values>(endpoint).then(setItem).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load."));
  }, [endpoint]);
  return (
    <div>
      <PageHeader title={title} description={description} />
      {error ? <p className="text-danger">{error}</p> : !item ? (
        <div className="grid place-items-center py-24 text-muted"><Spinner className="size-6" /></div>
      ) : (
        <Inner endpoint={endpoint} fields={fields} item={item} successText={successText} onSaved={setItem} />
      )}
    </div>
  );
}

function Inner({ endpoint, fields, item, successText, onSaved }: { endpoint: string; fields: FieldDef[]; item: Values; successText: string; onSaved: (v: Values) => void }) {
  const toast = useToast();
  const schema = useMemo(
    () => z.object(Object.fromEntries(fields.map((f) => [f.name, f.type === "visibility" ? z.record(z.string(), z.boolean()) : fieldSchema(f)]))),
    [fields],
  );
  const defaults = useMemo(() => {
    const v = initialValues({ fields: fields.filter((f) => f.type !== "visibility") }, item);
    for (const f of fields) if (f.type === "visibility") v[f.name] = { ...Object.fromEntries(SECTIONS.map((s) => [s, true])), ...(item[f.name] ?? {}) };
    for (const f of fields) if (f.type === "select" && v[f.name] == null) v[f.name] = "";
    return v;
  }, [fields, item]);
  const { register, control, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: defaults,
  });

  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const f of fields) map.set(f.section ?? "", [...(map.get(f.section ?? "") ?? []), f]);
    return [...map.entries()];
  }, [fields]);

  const onSubmit = async (values: Values) => {
    const payload: Values = {};
    for (const f of fields) {
      let v = values[f.name];
      if (typeof v === "string") v = v.trim();
      if (v === "" && !f.required) v = null;
      payload[f.name] = v;
    }
    try {
      const saved = await api<Values>(endpoint, { method: "PATCH", body: payload });
      onSaved(saved);
      reset(values);
      toast("success", successText);
    } catch (e) {
      if (e instanceof ApiError) {
        for (const err of e.errors) setError(err.field.split(".")[0], { message: err.message });
        toast("error", e.message);
      } else toast("error", "Could not save.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 pb-24">
      {sections.map(([name, fs]) => (
        <Card key={name} className="p-6">
          {name && <h2 className="mb-5 font-sans text-sm font-semibold tracking-normal text-muted">{name}</h2>}
          <div className="grid gap-5 md:grid-cols-2">
            {fs.map((f) => {
              const id = `f-${f.name}`;
              const err = errors[f.name]?.message as string | undefined;
              const span = f.span === 2 || ["textarea", "list", "image", "visibility"].includes(f.type) ? "md:col-span-2" : "";
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
              if (f.type === "visibility") {
                return (
                  <Controller key={f.name} name={f.name} control={control} render={({ field }) => (
                    <FieldShell label={f.label} className={span} help="Turn a section off to hide it without deleting its content.">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {SECTIONS.map((s) => (
                          <div key={s} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-sm capitalize">
                            {s}
                            <Switch checked={field.value?.[s] !== false} onChange={(v) => field.onChange({ ...field.value, [s]: v })} label={`Show ${s}`} />
                          </div>
                        ))}
                      </div>
                    </FieldShell>
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-6 py-3">
          {isDirty && <span className="mr-auto text-sm text-faint">Unsaved changes</span>}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner />} Save changes
          </button>
        </div>
      </div>
    </form>
  );
}
