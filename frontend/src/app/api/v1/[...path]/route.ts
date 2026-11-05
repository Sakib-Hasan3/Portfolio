import type { NextRequest } from "next/server";
import { proxy } from "@/lib/api/proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, `/api/v1/${path.map(encodeURIComponent).join("/")}`);
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
