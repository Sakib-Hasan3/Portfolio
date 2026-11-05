# AI assistant — "Ask Sakib's AI"

A RAG chatbot embedded in the public site. It answers visitor questions about the portfolio owner using **only
published content from PostgreSQL**, streams the answer, links to the relevant pages, and never needs a redeploy when
content changes.

```
 Admin saves content ──► FastAPI CRUD ──► background task ─► knowledge.reindex()
                                             │                    │ builds chunks from PUBLISHED rows
                                             │                    │ embeds only changed chunks
                                             │                    ▼
                                             │            knowledge_chunks (PostgreSQL, derived index)
                                             └─► Next.js cache revalidation       ▲ version bump = cache invalidation
 Visitor ─► POST /api/v1/assistant/chat ─► guard ─► hybrid retrieval ─► LLM (Groq/OpenAI/custom) ─► SSE stream
```

## Setup (2 minutes)

1. Create a free key at <https://console.groq.com> and add it to `.env`: `GROQ_API_KEY=...`
2. `docker compose up -d --build` — the migration creates the tables and the first index is built on startup.
3. Open `/admin/assistant` to change the name, model, instructions, suggested questions, limits and knowledge sources.

Without a key the assistant still works in a degraded mode: it quotes the most relevant portfolio passages (with links)
instead of generating prose, and tells the visitor the AI service is unavailable.

## What it knows (knowledge base)

Chunks are generated from published, non-deleted rows only, and respect "section visibility" in website settings:
profile + about, skills, projects (summary + description), publications (flagged *PUBLISHED RESEARCH* vs *PROJECT*),
education, experience, achievements, public contact info (phone only if `show_phone`), the **active CV** (text extracted
from the PDF), a generated overview (counts/lists for "how many…" questions) and optional owner-written "extra facts".
Each source can be switched off in the admin.

## Keeping it in sync

| Event | What happens |
|---|---|
| Create / edit / publish / unpublish / delete / restore any content, edit profile or settings, upload or activate a CV | A background task re-runs the indexer (coalesced if several edits arrive together). |
| Indexer | Rebuilds chunks, diffs by content hash, embeds **only new/changed chunks**, deletes stale ones, bumps `knowledge_version` if anything changed. Serialised across workers with a Postgres advisory lock. |
| Cache | Each API process caches the in-memory index keyed by `knowledge_version`, so a bump from any worker invalidates every worker's cache on the next request. |
| API restart | A full diff runs on startup, so edits made while the API was down are picked up. |
| Manual | *Admin → AI assistant → Rebuild index* (re-embeds everything), or `POST /api/v1/admin/assistant/reindex`. |

## Retrieval

* Hybrid: BM25 + vector similarity fused with reciprocal-rank fusion.
* Source-type routing so list/count questions ("which projects use FastAPI?", "how many papers?") get full coverage.
* Banglish / colloquial expansion (`kothay thake`, `gobeshona`, `projekt`, `porashona`, …) and inflection handling.
* Follow-ups borrow terms from the previous visitor question.
* Embeddings: `local` (default, hashed n-gram features, no key/network) or any OpenAI-compatible `/embeddings` API for
  true semantic search (`EMBEDDING_API_KEY`, optional `EMBEDDING_BASE_URL`; switch in the admin, then rebuild).
  Vectors live in PostgreSQL (`knowledge_chunks.embedding`) — fine for hundreds of chunks. For thousands, swap
  `retrieval.py`'s scoring for Qdrant/pgvector; the rest of the pipeline is unchanged.

## Safety

* The LLM is called only from the API; keys come from environment variables and never reach the browser or the DB.
* Fixed system rules (scope, accuracy, no invention, third-person AI identity, no commitments) are always prepended;
  the admin's "style instructions" are appended and cannot override them.
* Inputs are length-limited and stripped of control characters; roles are restricted to `user`/`assistant`;
  obvious prompt-injection phrases are refused without calling the model; retrieved text is delimited as data.
* The UI only renders links the server retrieved for that answer (a hallucinated URL shows as plain text).
* Per-IP per-minute and per-day limits plus a site-wide daily cap (all configurable); timeouts and provider errors fall
  back to an extractive answer.
* Analytics store a hashed session id, the question (emails/phones redacted, max 300 chars), token counts and latency —
  no IP address or user agent — and are purged after `ASSISTANT_LOG_RETENTION_DAYS` (90).

## API

Public (under `/api/v1`):

| Method | Path | Notes |
|---|---|---|
| POST | `/assistant/chat` | `{message, history[], session_id, stream}`. Default response is Server-Sent Events: `meta` (sources, allowed links, CTA) → `token`* → `done` (status, follow-up suggestions) / `error`. `stream:false` returns JSON. |
| GET | `/assistant/suggestions` | Configured starter questions. |
| GET | `/assistant/status` | Enabled flag, name, welcome text, placeholder, knowledge version. |

Admin (cookie session + CSRF, or bearer token):

| Method | Path |
|---|---|
| GET / PUT | `/admin/assistant/settings` (PUT is a partial update; never returns secrets) |
| POST | `/admin/assistant/reindex` |
| GET | `/admin/assistant/status`, `/admin/assistant/knowledge`, `/admin/assistant/analytics?days=14` |

## Tests

`backend/tests/test_assistant.py` covers publish-only indexing, automatic sync on edit/unpublish, incremental
reindexing, SSE streaming against a mock OpenAI-compatible server (including usage accounting), provider 401/429/500 and
timeout fallbacks, prompt-injection refusal, validation, rate limiting, redaction, and admin auth.
