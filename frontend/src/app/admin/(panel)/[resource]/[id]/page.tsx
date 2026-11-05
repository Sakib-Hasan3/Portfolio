"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ResourceForm } from "@/components/admin/resource-form";
import { Spinner } from "@/components/admin/ui";
import { api, ApiError } from "@/lib/admin/client";
import { RESOURCES } from "@/lib/admin/resources";

export default function ResourceEditPage() {
  const { resource, id } = useParams<{ resource: string; id: string }>();
  const def = RESOURCES[resource];
  const isNew = id === "new";
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!def || isNew) return;
    api<Record<string, unknown>>(`/admin/${def.name}/${id}`)
      .then(setItem)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? `This ${def.label.toLowerCase()} doesn't exist or was deleted.` : "Could not load this item."));
  }, [def, id, isNew]);

  if (!def) notFound();
  if (isNew) return <ResourceForm key="new" def={def} />;
  if (error) return <p className="text-danger">{error}</p>;
  if (!item) return <div className="grid place-items-center py-24 text-muted"><Spinner className="size-6" /></div>;
  return <ResourceForm key={String(item.id)} def={def} item={item} />;
}
