export type ChatRole = "user" | "assistant";

export interface Source {
  title: string;
  url: string;
  type: string;
}

export interface Cta {
  label: string;
  url: string;
}

export interface Turn {
  id: string;
  role: ChatRole;
  content: string;
  sources?: Source[];
  allowedUrls?: string[];
  cta?: Cta | null;
  suggestions?: string[];
  status?: "ok" | "fallback" | "blocked" | "error";
}

export interface AssistantStatus {
  enabled: boolean;
  name: string;
  welcome_message: string;
  placeholder: string;
  knowledge_version: number;
}

export interface StreamHandlers {
  onMeta: (m: { sources: Source[]; allowed_urls: string[]; cta: Cta | null }) => void;
  onToken: (text: string) => void;
  onDone: (d: { status: Turn["status"]; suggestions: string[] }) => void;
}

export class ChatError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** POSTs a question and consumes the Server-Sent Events stream from the API (via the same-origin proxy). */
export async function streamChat(
  body: { message: string; history: { role: ChatRole; content: string }[]; session_id: string },
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/v1/assistant/chat", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ChatError(typeof data?.detail === "string" ? data.detail : "The assistant is unavailable right now.", res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const ev = /^event: (.+)$/m.exec(frame)?.[1];
      const dataLine = /^data: (.+)$/m.exec(frame)?.[1];
      if (!ev || !dataLine) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataLine);
      } catch {
        continue;
      }
      if (ev === "meta") handlers.onMeta(data as Parameters<StreamHandlers["onMeta"]>[0]);
      else if (ev === "token") handlers.onToken((data as { text: string }).text);
      else if (ev === "done") handlers.onDone(data as Parameters<StreamHandlers["onDone"]>[0]);
      else if (ev === "error") throw new ChatError((data as { message?: string }).message || "Something went wrong.", 500);
    }
  }
}
