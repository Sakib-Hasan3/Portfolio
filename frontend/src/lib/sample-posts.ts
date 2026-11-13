import type { Note } from "@/lib/types";

/**
 * Starter articles shown only while no real blog post has been published in the admin.
 * As soon as one post is published (Admin → Blog), these disappear automatically.
 */
const d = (s: string) => new Date(s).toISOString();

export const SAMPLE_POSTS: Note[] = [
  {
    id: -1,
    title: "Building a RAG helpdesk that cites its sources",
    slug: "rag-helpdesk-with-citations",
    summary: "How retrieval, reranking and a strict prompt turn an LLM into an IT helpdesk agent people can actually trust.",
    tags: ["RAG", "LLM", "FastAPI"],
    cover_url: null,
    published_at: d("2026-10-20"),
    updated_at: d("2026-10-20"),
    reading_minutes: 4,
    content: `A helpdesk bot that sounds confident but invents answers is worse than no bot. When I built an enterprise IT helpdesk agent, the goal was simple: **every answer must point to a document a human wrote.**

## The pipeline

1. **Ingest** knowledge-base articles and split them into overlapping chunks.
2. **Embed** each chunk and store it in a vector database (Qdrant).
3. **Retrieve** the top candidates for a question.
4. **Rerank** them with a cross-encoder so the best three really are the best three.
5. **Generate** an answer from only those chunks, and return the chunk ids as citations.

## Why reranking matters

Vector search finds *similar* text, not necessarily *relevant* text. A question about "VPN drops on Wi-Fi" can pull in a page about "VPN setup on Wi-Fi". A reranker reads the question and each candidate together, which fixes most of these near-misses.

## A prompt that refuses to guess

\`\`\`text
Answer ONLY from the context below.
If the context does not contain the answer, say you don't know
and offer to create a ticket. Cite sources as [KB-id].
\`\`\`

That last line is the product: when the bot is unsure it escalates instead of improvising.

## What I'd do next

- Add feedback buttons and log the questions that end in "I don't know".
- Use those logs to find gaps in the knowledge base.
- Stream tokens so answers feel instant.

Trust comes from showing your work. Citations are cheap to add and change how users feel about the whole system.`,
  },
  {
    id: -2,
    title: "Making a portfolio feel 3D without killing performance",
    slug: "3d-portfolio-performance",
    summary: "Three.js, CSS perspective and a few rules that keep a 3D site fast on a normal laptop.",
    tags: ["Three.js", "Next.js", "Performance"],
    cover_url: null,
    published_at: d("2026-10-06"),
    updated_at: d("2026-10-06"),
    reading_minutes: 3,
    content: `A 3D portfolio is memorable, but a stuttering one is forgettable. These are the rules I follow.

## 1. Load it late

The text must paint first. I mount the WebGL scene only after the browser is idle, and only if WebGL is actually available.

## 2. Render only when something moves

A background that spins forever burns battery. My scene stops drawing after a few seconds without scroll or pointer input and wakes on the next movement.

## 3. Cap the pixel ratio

Rendering at 3× on a phone is wasted work. \`Math.min(devicePixelRatio, 1.25)\` is invisible to the eye and much cheaper.

## 4. Use CSS 3D where it is enough

Card tilt, carousels and scroll reveals only need \`perspective\` and \`transform\`. They run on the GPU compositor and cost almost nothing compared with a canvas.

## 5. Respect reduced motion

Some visitors get motion sick. Check \`prefers-reduced-motion\` and fall back to a calm, flat version.

## The result

One small WebGL scene, CSS 3D everywhere else, and a page that stays interactive while it animates. The trick is restraint: 3D should guide attention, not compete with your content.`,
  },
  {
    id: -3,
    title: "From idea to deployed: shipping a full-stack AI project",
    slug: "shipping-full-stack-ai-project",
    summary: "A practical checklist for taking an AI prototype to something other people can use.",
    tags: ["Engineering", "Deployment", "AI"],
    cover_url: null,
    published_at: d("2026-09-22"),
    updated_at: d("2026-09-22"),
    reading_minutes: 3,
    content: `Most AI projects die as a notebook. Here is the checklist I use to get one in front of real users.

## Make it reproducible

- Pin dependencies and document the environment variables.
- One command to run everything locally: \`docker compose up\`.

## Protect the edges

- Validate every input on the server, not just in the form.
- Rate-limit the endpoints that call a paid model.
- Keep secrets out of the repo and out of the frontend bundle.

## Make failure visible

- Structured logs with a request id.
- A health endpoint and a friendly error page.
- Show users a clear message when the model is slow or unavailable.

## Ship small, ship often

Deploy the thinnest working version first. A live link teaches you more than another week of polishing locally.

## Write it down

A short README with a screenshot, the architecture in one diagram and a "how to run" section is often what a recruiter reads first.`,
  },
];

export const SAMPLE_CARDS = SAMPLE_POSTS.map((p) => ({
  id: p.id, title: p.title, slug: p.slug, summary: p.summary, tags: p.tags,
  cover_url: p.cover_url, published_at: p.published_at, reading_minutes: p.reading_minutes,
}));
