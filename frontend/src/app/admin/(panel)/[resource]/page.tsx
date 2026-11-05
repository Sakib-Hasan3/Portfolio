"use client";

import { notFound, useParams } from "next/navigation";
import { ResourceList } from "@/components/admin/resource-list";
import { RESOURCES } from "@/lib/admin/resources";

export default function ResourceIndexPage() {
  const { resource } = useParams<{ resource: string }>();
  const def = RESOURCES[resource];
  if (!def) notFound();
  return <ResourceList key={def.name} def={def} />;
}
