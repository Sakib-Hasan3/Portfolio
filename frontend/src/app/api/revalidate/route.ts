import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const ALLOWED = new Set([
  "portfolio", "profile", "settings", "social", "skills", "publications", "projects",
  "education", "experience", "achievements", "resume",
]);

function secretOk(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET || "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called by FastAPI after any admin change so the public site shows it immediately. */
export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get("x-revalidate-secret"))) {
    return NextResponse.json({ detail: "Invalid revalidation secret" }, { status: 401 });
  }
  let tags: string[] = ["portfolio"];
  try {
    const body = await req.json();
    if (Array.isArray(body?.tags)) tags = body.tags.filter((t: unknown) => typeof t === "string" && ALLOWED.has(t));
  } catch {
    /* default tags */
  }
  for (const tag of new Set([...tags, "portfolio"])) revalidateTag(tag);
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: [...new Set([...tags, "portfolio"])], at: Date.now() });
}
