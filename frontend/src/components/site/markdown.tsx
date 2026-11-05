import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Safe, dependency-free Markdown renderer used for descriptions written in the admin dashboard.
 *
 * Supports: headings, paragraphs, **bold**, *italic*, ~~strike~~, `code`, fenced code blocks, links, images,
 * ordered/unordered (nested) lists, task items, blockquotes, horizontal rules and GFM tables.
 * Raw HTML is never interpreted (it is shown as text), and link/image URLs are restricted to
 * http(s), mailto and site-relative paths. Plain text written before Markdown support renders as it always did.
 */

function safeUrl(url: string, { image = false } = {}): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (!image && /^mailto:[^\s]+$/i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  if (!image && u.startsWith("#")) return u;
  return null;
}

const INLINE =
  /(`+)([\s\S]*?[^`])\1(?!`)|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+?)\*\*|__([^_]+?)__|~~([^~]+?)~~|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function renderInline(text: string, key = "i"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[2] !== undefined) {
      out.push(<code key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.88em] text-text">{m[2].trim()}</code>);
    } else if (m[4] !== undefined) {
      const src = safeUrl(m[4], { image: true });
      out.push(
        src ? (
          <img key={k} src={src} alt={m[3]} loading="lazy" className="my-3 max-h-[28rem] rounded-lg border border-line" />
        ) : (
          m[3]
        ),
      );
    } else if (m[6] !== undefined) {
      const href = safeUrl(m[6]);
      const label = renderInline(m[5], k);
      if (!href) out.push(<Fragment key={k}>{label}</Fragment>);
      else {
        const external = /^https?:\/\//i.test(href);
        out.push(
          <a key={k} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
            {label}
          </a>,
        );
      }
    } else if (m[7] !== undefined || m[8] !== undefined) {
      out.push(<strong key={k} className="font-semibold text-text">{renderInline(m[7] ?? m[8], k)}</strong>);
    } else if (m[9] !== undefined) {
      out.push(<del key={k}>{renderInline(m[9], k)}</del>);
    } else if (m[10] !== undefined || m[11] !== undefined) {
      out.push(<em key={k}>{renderInline(m[10] ?? m[11], k)}</em>);
    } else if (m[12] !== undefined) {
      out.push(
        <a key={k} href={m[12]} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
          {m[12]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ------------------------------------------------------------------ block parsing

type ListItem = { text: string; checked?: boolean; children?: ListNode };
type ListNode = { ordered: boolean; items: ListItem[] };
type Block =
  | { t: "p"; text: string }
  | { t: "h"; level: number; text: string }
  | { t: "code"; lang: string; text: string }
  | { t: "quote"; text: string }
  | { t: "hr" }
  | { t: "list"; list: ListNode }
  | { t: "table"; head: string[]; align: ("left" | "center" | "right" | undefined)[]; rows: string[][] };

const LIST_RE = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;
const splitRow = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");

function parseList(lines: string[], start: number, indent: number): [ListNode, number] {
  const first = LIST_RE.exec(lines[start])!;
  const node: ListNode = { ordered: /\d/.test(first[2]), items: [] };
  let i = start;
  while (i < lines.length) {
    const m = LIST_RE.exec(lines[i]);
    if (!m) break;
    const ind = m[1].replace(/\t/g, "    ").length;
    if (ind < indent) break;
    if (ind === indent && /\d/.test(m[2]) !== node.ordered) break; // switching bullet <-> numbered starts a new list
    if (ind > indent) {
      const last = node.items[node.items.length - 1];
      if (!last) break;
      const [child, next] = parseList(lines, i, ind);
      last.children = child;
      i = next;
      continue;
    }
    let text = m[3];
    let checked: boolean | undefined;
    const task = /^\[( |x|X)\]\s+(.*)$/.exec(text);
    if (task) {
      checked = task[1] !== " ";
      text = task[2];
    }
    node.items.push({ text, checked });
    i++;
  }
  return [node, i];
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*(`{3,}|~{3,})\s*([\w+#-]*)/.exec(line);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push({ t: "code", lang: fence[2], text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      blocks.push({ t: "h", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", text: buf.join("\n") });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : undefined));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(splitRow(lines[i++]));
      blocks.push({ t: "table", head, align, rows });
      continue;
    }
    if (LIST_RE.test(line)) {
      const indent = LIST_RE.exec(line)![1].replace(/\t/g, "    ").length;
      const [list, next] = parseList(lines, i, indent);
      blocks.push({ t: "list", list });
      i = next;
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(`{3,}|~{3,})/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !LIST_RE.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    blocks.push({ t: "p", text: buf.join("\n") });
  }
  return blocks;
}

function ListView({ list, k }: { list: ListNode; k: string }) {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-1.5 pl-5 marker:text-faint", list.ordered ? "list-decimal" : "list-disc")}>
      {list.items.map((it, i) => (
        <li key={i} className={it.checked !== undefined ? "list-none" : undefined}>
          {it.checked !== undefined && (
            <span aria-hidden className="mr-2 inline-block w-4 text-center text-accent">{it.checked ? "☑" : "☐"}</span>
          )}
          {renderInline(it.text, `${k}-${i}`)}
          {it.children && <div className="mt-1.5"><ListView list={it.children} k={`${k}-${i}c`} /></div>}
        </li>
      ))}
    </Tag>
  );
}

const HEADING_CLASS = [
  "text-2xl md:text-3xl font-semibold text-text mt-8 first:mt-0",
  "text-xl md:text-2xl font-semibold text-text mt-7 first:mt-0",
  "text-lg md:text-xl font-semibold text-text mt-6 first:mt-0",
  "text-base font-semibold text-text mt-5 first:mt-0",
  "text-base font-semibold text-text mt-4 first:mt-0",
  "text-sm font-semibold uppercase tracking-wide text-muted mt-4 first:mt-0",
];

export function Markdown({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text?.trim()) return null;
  const blocks = parseBlocks(text);
  return (
    <div className={cn("space-y-4 [overflow-wrap:anywhere]", className)}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "p":
            return <p key={k} className="whitespace-pre-line">{renderInline(b.text, k)}</p>;
          case "h": {
            // page/section titles already use h1/h2, so "#" renders as an h3
            const Tag = `h${Math.min(b.level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
            return <Tag key={k} className={HEADING_CLASS[b.level - 1]}>{renderInline(b.text, k)}</Tag>;
          }
          case "code":
            return (
              <pre key={k} className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-4 font-mono text-[0.85rem] leading-relaxed text-text" tabIndex={0}>
                <code data-lang={b.lang || undefined}>{b.text}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote key={k} className="border-l-2 border-accent/50 pl-4 italic text-muted">
                <Markdown text={b.text} className="space-y-2" />
              </blockquote>
            );
          case "hr":
            return <hr key={k} className="border-line" />;
          case "list":
            return <ListView key={k} list={b.list} k={k} />;
          case "table":
            return (
              <div key={k} className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-2 text-text">
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} scope="col" className="border-b border-line px-3 py-2 font-semibold" style={{ textAlign: b.align[j] }}>
                          {renderInline(c, `${k}h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} className="border-t border-line">
                        {b.head.map((_, j) => (
                          <td key={j} className="px-3 py-2 align-top" style={{ textAlign: b.align[j] }}>
                            {renderInline(r[j] ?? "", `${k}r${ri}c${j}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
