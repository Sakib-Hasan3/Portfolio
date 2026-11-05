"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Eraser, MessageCircle, RotateCcw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { type AssistantStatus, ChatError, type Turn, streamChat } from "@/lib/assistant/stream";
import { AnswerMarkdown } from "./markdown";

const STORE_KEY = "ask-ai:v1";
const MAX_TURNS = 40;
const uid = () => Math.random().toString(36).slice(2, 10);

function loadSession(): { sessionId: string; turns: Turn[] } {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.sessionId && Array.isArray(p.turns)) return p;
    }
  } catch {
    /* storage unavailable (private mode) – start fresh */
  }
  return { sessionId: crypto.randomUUID?.() ?? uid() + uid(), turns: [] };
}

export function AssistantWidget() {
  const reduce = useReducedMotion();
  const panelId = useId();
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const stickToBottom = useRef(true);

  // ---- boot: status + suggestions + restore this visitor's session
  useEffect(() => {
    const s = loadSession();
    setSessionId(s.sessionId);
    setTurns(s.turns.filter((t) => t.content));
    let cancelled = false;
    (async () => {
      try {
        const [st, sg] = await Promise.all([
          fetch("/api/v1/assistant/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/v1/assistant/suggestions", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
        ]);
        if (cancelled) return;
        setStatus(st);
        setSuggestions(Array.isArray(sg) ? sg : []);
      } catch {
        /* assistant simply stays hidden if the API is unreachable */
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ sessionId, turns: turns.slice(-MAX_TURNS) }));
    } catch {
      /* ignore */
    }
  }, [turns, sessionId]);

  // ---- scroll handling: follow the stream unless the visitor scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [turns, thinking, open]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // ---- open/close: focus, Escape, body scroll lock on mobile
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    const prev = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    fabRef.current?.focus({ preventScroll: true });
  }, []);

  const closeOnMobile = useCallback(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }, []);

  const send = useCallback(
    async (raw: string, base?: Turn[]) => {
      const message = raw.trim().slice(0, 600);
      if (!message || busy) return;
      const history = (base ?? turns)
        .filter((t) => t.content && t.status !== "error")
        .slice(-8)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 1200) }));
      const userTurn: Turn = { id: uid(), role: "user", content: message };
      const botId = uid();
      stickToBottom.current = true;
      const botTurn: Turn = { id: botId, role: "assistant", content: "" };
      setTurns((t) => [...(base ?? t), userTurn, botTurn]);
      setInput("");
      setBusy(true);
      setThinking(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t) => (t.id === botId ? fn(t) : t)));
      try {
        await streamChat(
          { message, history, session_id: sessionId },
          {
            onMeta: (m) => patch((t) => ({ ...t, sources: m.sources, allowedUrls: m.allowed_urls, cta: m.cta })),
            onToken: (text) => {
              setThinking(false);
              patch((t) => ({ ...t, content: t.content + text }));
            },
            onDone: (d) => patch((t) => ({ ...t, status: d.status, suggestions: d.suggestions })),
          },
          ctrl.signal,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const msg =
            e instanceof ChatError && (e.status === 429 || e.status === 503)
              ? e.message
              : "I couldn't reach the assistant just now. Please try again in a moment.";
          patch((t) => ({ ...t, content: t.content ? `${t.content}\n\n_(interrupted)_` : msg, status: "error", sources: [], suggestions: [] }));
        }
      } finally {
        setBusy(false);
        setThinking(false);
        abortRef.current = null;
      }
    },
    [busy, turns, sessionId],
  );

  const clear = () => {
    abortRef.current?.abort();
    setTurns([]);
    setBusy(false);
    setThinking(false);
    setSessionId(crypto.randomUUID?.() ?? uid() + uid());
    inputRef.current?.focus();
  };

  const retry = (botId: string) => {
    const i = turns.findIndex((t) => t.id === botId);
    const q = turns[i - 1];
    if (!q || q.role !== "user") return;
    send(q.content, turns.slice(0, i - 1));
  };

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  if (!status?.enabled) return null;
  const name = status.name;
  const lastBot = [...turns].reverse().find((t) => t.role === "assistant");

  return (
    <div className="ai-theme">
      {/* floating launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            ref={fabRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Open ${name}`}
            aria-expanded={open}
            aria-controls={panelId}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            whileHover={reduce ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="ai-fab group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2.5 rounded-full py-2.5 pl-3 pr-4 max-[420px]:p-2.5 sm:bottom-6 sm:right-6"
          >
            <span className="ai-fab-icon relative grid size-8 place-items-center rounded-full">
              <Sparkles className="size-[18px]" aria-hidden />
            </span>
            <span className="max-w-[9.5rem] truncate text-sm font-medium tracking-tight max-[420px]:hidden">{name}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            id={panelId}
            role="dialog"
            aria-label={name}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="ai-panel fixed inset-0 z-50 flex flex-col overflow-hidden sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-[26rem] sm:rounded-2xl"
          >
            <header className="ai-header flex items-center gap-3 px-4 py-3.5">
              <span className="ai-fab-icon grid size-9 shrink-0 place-items-center rounded-full">
                <Sparkles className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-[15px] font-semibold leading-tight text-[var(--ai-text)]">{name}</h2>
                <p className="flex items-center gap-1.5 text-xs text-[var(--ai-muted)]">
                  <span className="ai-dot" aria-hidden /> AI assistant · answers from this portfolio
                </p>
              </div>
              {turns.length > 0 && (
                <button type="button" onClick={clear} className="ai-icon-btn" aria-label="Clear conversation" title="Clear conversation">
                  <Eraser className="size-4" />
                </button>
              )}
              <button type="button" onClick={close} className="ai-icon-btn" aria-label="Close assistant">
                <X className="size-[18px]" />
              </button>
            </header>

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="ai-scroll flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {turns.length === 0 && (
                <div className="ai-card p-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--ai-gold)]">
                    <Sparkles className="size-3.5" aria-hidden /> Hello
                  </p>
                  <p className="text-[14.5px] leading-relaxed text-[var(--ai-text)]">{status.welcome_message}</p>
                </div>
              )}

              {turns.map((t) =>
                t.role === "user" ? (
                  <div key={t.id} className="flex justify-end">
                    <p className="ai-user max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2 text-[14.5px] leading-relaxed">
                      {t.content}
                    </p>
                  </div>
                ) : (
                  <div key={t.id} className="space-y-2.5">
                    <article className="ai-card p-4 text-[14.5px] leading-relaxed text-[var(--ai-text)]/92" aria-busy={busy && t === lastBot}>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--ai-gold)]">
                        <Sparkles className="size-3" aria-hidden /> {name}
                      </p>
                      {t.content ? (
                        <>
                          <AnswerMarkdown text={t.content} allowedUrls={t.allowedUrls ?? []} onNavigate={closeOnMobile} />
                          {busy && t === lastBot && <span className="ai-caret" aria-hidden />}
                        </>
                      ) : (
                        <TypingDots />
                      )}
                      {t.status === "error" && (
                        <button type="button" onClick={() => retry(t.id)} className="ai-chip mt-3 !gap-1.5">
                          <RotateCcw className="size-3" /> Try again
                        </button>
                      )}
                    </article>

                    {!!t.sources?.length && t.content && !(busy && t === lastBot) && t.status !== "blocked" && t.status !== "error" && (
                      <div className="flex flex-wrap items-center gap-1.5 px-1">
                        <span className="text-[11px] uppercase tracking-wider text-[var(--ai-muted)]">From</span>
                        {t.sources.map((s) => (
                          <Link key={s.url} href={s.url} onClick={closeOnMobile} className="ai-chip" title={s.title}>
                            <span className="max-w-[10.5rem] truncate">{s.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {t.cta && t.content && !(busy && t === lastBot) && t.status !== "blocked" && (
                      <div className="px-1">
                        <Link href={t.cta.url} onClick={closeOnMobile} className="ai-cta">
                          <MessageCircle className="size-4" aria-hidden /> {t.cta.label}
                        </Link>
                      </div>
                    )}

                    {t === lastBot && !busy && !!t.suggestions?.length && (
                      <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
                        {t.suggestions.map((q) => (
                          <button key={q} type="button" className="ai-chip ai-chip-suggest" onClick={() => send(q)}>
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}

              {turns.length === 0 && suggestions.length > 0 && (
                <div>
                  <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--ai-muted)]">Try asking</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((q) => (
                      <button key={q} type="button" className="ai-chip ai-chip-suggest" onClick={() => send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {thinking && <span className="sr-only">The assistant is typing</span>}
            </div>

            <form
              className="ai-footer px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="ai-input flex items-end gap-2 rounded-xl p-1.5 pl-3.5">
                <label htmlFor={`${panelId}-in`} className="sr-only">Your question</label>
                <textarea
                  id={`${panelId}-in`}
                  ref={inputRef}
                  rows={1}
                  maxLength={600}
                  value={input}
                  placeholder={status.placeholder}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autosize(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                      if (inputRef.current) inputRef.current.style.height = "auto";
                    }
                  }}
                  className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14.5px] text-[var(--ai-text)] outline-none placeholder:text-[var(--ai-muted)]"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="ai-send grid size-9 shrink-0 place-items-center rounded-lg"
                  aria-label="Send question"
                >
                  <ArrowUp className="size-[18px]" />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-[var(--ai-muted)]">
                AI-generated from published portfolio content — it can make mistakes.
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Typing">
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot [animation-delay:150ms]" />
      <span className="ai-typing-dot [animation-delay:300ms]" />
    </span>
  );
}
