import { getPortfolioSafe, getProject } from "@/lib/api/server";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Project preview";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, project] = await Promise.all([getPortfolioSafe(), getProject(slug).catch(() => null)]);
  return ogCard({
    eyebrow: project?.category ?? "Project",
    title: project?.title ?? "Project",
    subtitle: project?.short_description,
    chips: project?.technologies ?? [],
    footer: data?.profile?.full_name,
  });
}
