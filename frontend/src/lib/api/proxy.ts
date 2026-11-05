import { type NextRequest, NextResponse } from "next/server";
import { API_INTERNAL_URL } from "./server";

const FORWARD_REQUEST_HEADERS = ["accept", "content-type", "cookie", "x-csrf-token", "user-agent", "authorization"];
const DROP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie"]);

/**
 * Same-origin proxy from the Next.js app to FastAPI. The browser only ever
 * talks to this origin, so auth cookies stay first-party (HttpOnly, SameSite)
 * and the backend address is a runtime setting rather than baked into the build.
 */
export async function proxy(req: NextRequest, upstreamPath: string): Promise<Response> {
  const target = `${API_INTERNAL_URL}${upstreamPath}${req.nextUrl.search}`;
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  if (fwd) headers.set("x-forwarded-for", fwd);
  headers.set("x-forwarded-host", req.headers.get("host") || "");
  headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "The content API is unreachable. Try again shortly.", code: "upstream_unavailable" }, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);

  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}
