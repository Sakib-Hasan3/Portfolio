"use client";

import { Activity, BookOpenCheck, Database, RefreshCw, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldShell, ListInput } from "@/components/admin/fields";
import { Badge, Card, PageHeader, Spinner, Switch, useToast } from "@/components/admin/ui";
import { api, ApiError } from "@/lib/admin/client";
import { cn } from "@/lib/utils";

type AssistantSettings = {
  enabled: boolean;
  name: string;
  welcome_message: string;
  placeholder: string;
  system_instructions: string;
  provider: "groq" | "openai" | "custom";
  model: string;
  temperature: number;
  max_output_tokens: number;
  top_k: number;
  embedding_provider: "local" | "openai";
  embedding_model: string;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  global_daily_cap: number;
  suggested_questions: string[];
  enabled_sources: Record<string, boolean>;
  custom_knowledge: string;
  knowledge_version: number;
  index_status: "idle" | "indexing" | "ready" | "error";
  index_error: string | null;
  last_indexed_at: string | null;
  chunk_count: number;
  llm_configured: boolean;
  embeddings_configured: boolean;
};

type Status = {
  index_status: AssistantSettings["index_status"];
  index_error: string | null;
  knowledge_version: number;
  chunk_count: number;
  last_indexed_at: string | null;
  llm_configured: boolean;
  sources: { type: string; chunks: number; updated_at: string }[];
};

type Analytics = {
  window_days: number;
  total_questions: number;
  questions_today: number;
  unique_sessions: number;
  answered: number;
  fallback: number;
  blocked: number;
  errors: number;
  unanswered_or_off_topic: number;
  prompt_tokens: number;
  completion_tokens: number;
  avg_latency_ms: number;
  per_day: { date: string; count: number }[];
  recent: { at: string; question: string; status: string; relevant: boolean; latency_ms: number }[];
};

type Chunk = { key: string; type: string; title: string; url: string | null; version: number; preview: string };

const SOURCES: { key: string; label: string; types: string[]; help: string }[] = [
  { key: "profile", label: "Profile & about", types: ["profile"], help: "Name, title, headline, location, about text" },
  { key: "skills", label: "Technical skills", types: ["skill"], help: "Skill categories and skills" },
  { key: "projects", label: "Projects", types: ["project"], help: "Published projects and descriptions" },
  { key: "publications", label: "Research publications", types: ["publication"], help: "Published papers (IEEE etc.)" },
  { key: "education", label: "Education", types: ["education"], help: "Degrees and institutions" },
  { key: "experience", label: "Experience & leadership", types: ["experience"], help: "Roles and organisations" },
  { key: "achievements", label: "Achievements", types: ["achievement"], help: "Awards and certifications" },
  { key: "testimonials", label: "Testimonials", types: ["testimonial"], help: "Quotes from others (always attributed)" },
  { key: "notes", label: "Notes / blog", types: ["note"], help: "Your published write-ups" },
  { key: "contact", label: "Public contact info", types: ["contact"], help: "Email, social links, availability" },
  { key: "resume", label: "CV / résumé", types: ["resume"], help: "Active CV file and its extracted text" },
  { key: "custom", label: "Extra facts (below)", types: ["custom"], help: "Your own curated notes" },
];

const MODELS: Record<string, string[]> = {
  groq: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  custom: [],
};

const TABS = [
  { key: "settings", label: "Settings", icon: Settings2 },
  { key: "knowledge", label: "Knowledge", icon: BookOpenCheck },
  { key: "analytics", label: "Analytics", icon: Activity },
] as const;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

export default function AssistantAdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("settings");
  const [cfg, setCfg] = useState<AssistantSettings | null>(null);
  const [form, setForm] = useState<AssistantSettings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const loadStatus = useCallback(() => api<Status>("/admin/assistant/status").then(setStatus).catch(() => {}), []);
  const loadSettings = useCallback(
    () =>
      api<AssistantSettings>("/admin/assistant/settings")
        .then((s) => {
          setCfg(s);
          setForm((f) => f ?? s);
        })
        .catch((e) => toast("error", e instanceof ApiError ? e.message : "Could not load settings")),
    [toast],
  );
  useEffect(() => {
    loadSettings();
    loadStatus();
  }, [loadSettings, loadStatus]);

  // keep the status fresh while an index build is running
  useEffect(() => {
    if (status?.index_status !== "indexing") return;
    const t = setInterval(loadStatus, 1500);
    return () => clearInterval(t);
  }, [status?.index_status, loadStatus]);

  const set = <K extends keyof AssistantSettings>(k: K, v: AssistantSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = !!form && !!cfg && JSON.stringify(strip(form)) !== JSON.stringify(strip(cfg));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await api<AssistantSettings>("/admin/assistant/settings", { method: "PUT", body: strip(form) });
      setCfg(saved);
      setForm(saved);
      toast("success", "Assistant settings saved");
      setTimeout(loadStatus, 1200);
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      await api("/admin/assistant/reindex", { method: "POST" });
      toast("info", "Rebuilding the knowledge index…");
      setStatus((s) => (s ? { ...s, index_status: "indexing" } : s));
      setTimeout(loadStatus, 800);
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Could not start the rebuild");
    } finally {
      setReindexing(false);
    }
  };

  if (!form || !cfg) {
    return (
      <div className="grid h-64 place-items-center text-muted">
        <Spinner className="size-6" />
      </div>
    );
  }

  const indexing = status?.index_status === "indexing";
  return (
    <div>
      <PageHeader
        title="AI assistant"
        description="Manage “Ask Sakib's AI”: the visitor-facing chat that answers from your published portfolio. Content edits sync to its knowledge automatically."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={reindex} disabled={reindexing || indexing}>
              <RefreshCw className={cn("size-4", indexing && "animate-spin")} /> Rebuild index
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
              {saving ? <Spinner /> : null} Save changes
            </button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Assistant" value={<Badge tone={cfg.enabled ? "ok" : "neutral"}>{cfg.enabled ? "Live" : "Turned off"}</Badge>} />
        <Stat
          label="Language model"
          value={cfg.llm_configured ? <Badge tone="ok">Key configured</Badge> : <Badge tone="warn">No API key</Badge>}
          hint={cfg.llm_configured ? `${cfg.provider} · ${cfg.model}` : `Set ${cfg.provider === "groq" ? "GROQ_API_KEY" : cfg.provider === "openai" ? "OPENAI_API_KEY" : "LLM_BASE_URL + LLM_API_KEY"} on the server. Until then answers quote the portfolio directly.`}
        />
        <Stat
          label="Knowledge index"
          value={
            <Badge tone={status?.index_status === "ready" ? "ok" : status?.index_status === "error" ? "danger" : "accent"}>
              {status?.index_status ?? cfg.index_status}
            </Badge>
          }
          hint={`${status?.chunk_count ?? cfg.chunk_count} chunks · v${status?.knowledge_version ?? cfg.knowledge_version}`}
        />
        <Stat label="Last synced" value={<span className="text-sm">{fmt(status?.last_indexed_at ?? cfg.last_indexed_at)}</span>} hint={status?.index_error ?? undefined} />
      </div>

      <div className="mb-6 flex gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.key ? "border-accent text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab form={form} set={set} />}
      {tab === "knowledge" && <KnowledgeTab form={form} set={set} status={status} />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

/** Fields the API accepts (everything else on the read model is read-only state). */
function strip(s: AssistantSettings) {
  const {
    enabled, name, welcome_message, placeholder, system_instructions, provider, model, temperature, max_output_tokens, top_k,
    embedding_provider, embedding_model, rate_limit_per_minute, rate_limit_per_day, global_daily_cap, suggested_questions,
    enabled_sources, custom_knowledge,
  } = s;
  return {
    enabled, name, welcome_message, placeholder, system_instructions, provider, model, temperature, max_output_tokens, top_k,
    embedding_provider, embedding_model, rate_limit_per_minute, rate_limit_per_day, global_daily_cap, suggested_questions,
    enabled_sources, custom_knowledge,
  };
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-2">{value}</div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

type TabProps = { form: AssistantSettings; set: <K extends keyof AssistantSettings>(k: K, v: AssistantSettings[K]) => void };

function SettingsTab({ form, set }: TabProps) {
  const num = (k: keyof AssistantSettings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-5 p-5">
        <h2 className="flex items-center gap-2 text-lg"><Sparkles className="size-4 text-accent" /> Identity & behaviour</h2>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
          <div>
            <p className="text-sm font-medium">Show the assistant on the site</p>
            <p className="text-xs text-muted">When off, the floating button disappears and the chat API refuses requests.</p>
          </div>
          <Switch checked={form.enabled} onChange={(v) => set("enabled", v)} label="Enable assistant" />
        </div>
        <FieldShell label="Assistant name" htmlFor="a-name">
          <input id="a-name" className="field" maxLength={60} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </FieldShell>
        <FieldShell label="Input placeholder" htmlFor="a-ph">
          <input id="a-ph" className="field" maxLength={120} value={form.placeholder} onChange={(e) => set("placeholder", e.target.value)} />
        </FieldShell>
        <FieldShell label="Welcome message" htmlFor="a-welcome" help="Use {name} for the portfolio owner's name.">
          <textarea id="a-welcome" rows={3} className="field resize-y" maxLength={800} value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
        </FieldShell>
        <FieldShell
          label="Style instructions"
          htmlFor="a-sys"
          help="Tone and formatting guidance. The scope, accuracy and safety rules are built in and can't be overridden here."
        >
          <textarea id="a-sys" rows={5} className="field resize-y" maxLength={4000} value={form.system_instructions} onChange={(e) => set("system_instructions", e.target.value)} />
        </FieldShell>
        <FieldShell label="Suggested questions" htmlFor="a-sugg" help="One per line (up to 12). Shown as quick-start chips.">
          <ListInput id="a-sugg" value={form.suggested_questions} onChange={(v) => set("suggested_questions", v.slice(0, 12))} rows={6} />
        </FieldShell>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-5 p-5">
          <h2 className="text-lg">Language model</h2>
          <p className="-mt-3 text-sm text-muted">API keys live in the server environment and are never shown here or sent to the browser.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Provider" htmlFor="a-prov">
              <select id="a-prov" className="field" value={form.provider} onChange={(e) => set("provider", e.target.value as AssistantSettings["provider"])}>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </FieldShell>
            <FieldShell label="Model" htmlFor="a-model">
              <input id="a-model" className="field" list="a-models" maxLength={100} value={form.model} onChange={(e) => set("model", e.target.value)} />
              <datalist id="a-models">{MODELS[form.provider].map((m) => <option key={m} value={m} />)}</datalist>
            </FieldShell>
            <FieldShell label={`Temperature (${form.temperature.toFixed(1)})`} htmlFor="a-temp" help="Lower = more factual and consistent.">
              <input id="a-temp" type="range" min={0} max={1.5} step={0.1} className="w-full accent-[var(--accent)]" value={form.temperature} onChange={num("temperature")} />
            </FieldShell>
            <FieldShell label="Max answer tokens" htmlFor="a-tok">
              <input id="a-tok" type="number" min={64} max={2000} className="field" value={form.max_output_tokens} onChange={num("max_output_tokens")} />
            </FieldShell>
            <FieldShell label="Passages retrieved per question" htmlFor="a-k">
              <input id="a-k" type="number" min={3} max={14} className="field" value={form.top_k} onChange={num("top_k")} />
            </FieldShell>
          </div>
        </Card>

        <Card className="space-y-5 p-5">
          <h2 className="text-lg">Limits</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell label="Per visitor / minute" htmlFor="a-rpm">
              <input id="a-rpm" type="number" min={1} max={120} className="field" value={form.rate_limit_per_minute} onChange={num("rate_limit_per_minute")} />
            </FieldShell>
            <FieldShell label="Per visitor / day" htmlFor="a-rpd">
              <input id="a-rpd" type="number" min={1} max={5000} className="field" value={form.rate_limit_per_day} onChange={num("rate_limit_per_day")} />
            </FieldShell>
            <FieldShell label="Site-wide / day" htmlFor="a-cap" help="Caps total spend.">
              <input id="a-cap" type="number" min={10} max={100000} className="field" value={form.global_daily_cap} onChange={num("global_daily_cap")} />
            </FieldShell>
          </div>
        </Card>

        <Card className="space-y-5 p-5">
          <h2 className="text-lg">Embeddings (semantic search)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Provider" htmlFor="a-eprov" help="“Local” needs no key. Choose OpenAI-compatible for true semantic embeddings.">
              <select id="a-eprov" className="field" value={form.embedding_provider} onChange={(e) => set("embedding_provider", e.target.value as AssistantSettings["embedding_provider"])}>
                <option value="local">Local (built-in, no key)</option>
                <option value="openai">OpenAI-compatible API</option>
              </select>
            </FieldShell>
            <FieldShell label="Model" htmlFor="a-emodel">
              <input id="a-emodel" className="field" disabled={form.embedding_provider === "local"} value={form.embedding_model} onChange={(e) => set("embedding_model", e.target.value)} />
            </FieldShell>
          </div>
          {form.embedding_provider === "openai" && !form.embeddings_configured && (
            <p className="text-sm text-danger">No embedding API key on the server — set EMBEDDING_API_KEY (or OPENAI_API_KEY), then rebuild the index.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function KnowledgeTab({ form, set, status }: TabProps & { status: Status | null }) {
  const [filter, setFilter] = useState("");
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const counts = new Map((status?.sources ?? []).map((s) => [s.type, s.chunks]));

  useEffect(() => {
    api<Chunk[]>("/admin/assistant/knowledge", { query: { source_type: filter } }).then(setChunks).catch(() => setChunks([]));
  }, [filter, status?.knowledge_version]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg"><Database className="size-4 text-accent" /> Knowledge sources</h2>
          <p className="mb-4 text-sm text-muted">Only <strong>published</strong> content is ever indexed. Turn a source off to stop the assistant using it (then save).</p>
          <ul className="divide-y divide-line">
            {SOURCES.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="truncate text-xs text-muted">{s.help}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{s.types.reduce((n, t) => n + (counts.get(t) ?? 0), 0)} chunks</Badge>
                  <Switch
                    checked={form.enabled_sources[s.key] !== false}
                    onChange={(v) => set("enabled_sources", { ...form.enabled_sources, [s.key]: v })}
                    label={`Use ${s.label}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <FieldShell
            label="Extra facts"
            htmlFor="a-custom"
            help="Public, factual notes the assistant may quote (e.g. preferred collaboration topics). Plain text, up to 12,000 characters."
          >
            <textarea id="a-custom" rows={7} className="field resize-y" maxLength={12000} value={form.custom_knowledge} onChange={(e) => set("custom_knowledge", e.target.value)} />
          </FieldShell>
        </Card>
      </div>

      <Card className="lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="text-lg">What the assistant currently knows</h2>
          <select className="field !w-auto" aria-label="Filter by source" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All sources</option>
            {(status?.sources ?? []).map((s) => <option key={s.type} value={s.type}>{s.type} ({s.chunks})</option>)}
          </select>
        </div>
        {chunks === null ? (
          <div className="grid h-40 place-items-center"><Spinner className="size-5" /></div>
        ) : chunks.length === 0 ? (
          <p className="p-6 text-sm text-muted">Nothing indexed yet. Click “Rebuild index”.</p>
        ) : (
          <ul className="max-h-[42rem] divide-y divide-line overflow-y-auto">
            {chunks.map((c) => (
              <li key={c.key} className="p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{c.type}</Badge>
                  <span className="text-sm font-medium">{c.title}</span>
                  <span className="ml-auto text-xs text-faint">v{c.version}</span>
                </div>
                <p className="line-clamp-3 text-xs text-muted">{c.preview}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AnalyticsTab() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Analytics | null>(null);
  useEffect(() => {
    api<Analytics>("/admin/assistant/analytics", { query: { days } }).then(setData).catch(() => {});
  }, [days]);
  if (!data) return <div className="grid h-40 place-items-center"><Spinner className="size-5" /></div>;
  const max = Math.max(1, ...data.per_day.map((d) => d.count));
  const tone = (s: string) => (s === "ok" ? "ok" : s === "fallback" ? "warn" : s === "blocked" ? "neutral" : "danger");
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select className="field !w-auto" aria-label="Time window" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 14, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Questions" value={<span className="text-2xl font-semibold">{data.total_questions}</span>} hint={`${data.questions_today} today · ${data.unique_sessions} visitors`} />
        <Stat label="Answered by the model" value={<span className="text-2xl font-semibold">{data.answered}</span>} hint={`${data.fallback} fallback · ${data.blocked} blocked · ${data.errors} errors`} />
        <Stat label="Tokens used" value={<span className="text-2xl font-semibold">{(data.prompt_tokens + data.completion_tokens).toLocaleString()}</span>} hint={`${data.prompt_tokens.toLocaleString()} in · ${data.completion_tokens.toLocaleString()} out`} />
        <Stat label="Avg response time" value={<span className="text-2xl font-semibold">{(data.avg_latency_ms / 1000).toFixed(1)}s</span>} hint={`${data.unanswered_or_off_topic} questions had no relevant knowledge`} />
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-lg">Questions per day</h2>
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Bar chart of questions per day">
          {data.per_day.map((d) => (
            <div key={d.date} className="group relative flex-1">
              <div className="rounded-t bg-accent/70 transition-colors group-hover:bg-accent" style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 text-xs group-hover:block">
                {d.date.slice(5)}: {d.count}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="border-b border-line p-4 text-lg">Recent questions</h2>
        {data.recent.length === 0 ? (
          <p className="p-6 text-sm text-muted">No visitor questions yet. Contact details are redacted before storage; IP addresses are never stored.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span className="min-w-0 flex-1 break-words">{r.question}</span>
                {!r.relevant && <Badge tone="warn">no match</Badge>}
                <Badge tone={tone(r.status)}>{r.status}</Badge>
                <span className="text-xs text-faint">{new Date(r.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
