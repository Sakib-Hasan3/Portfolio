import Link from "next/link";
import { Fragment } from "react";

/**
 * Tiny, safe renderer for assistant answers: paragraphs, bullet/numbered lists, **bold**, `code` and links.
 * It never injects HTML. Links are only rendered if the URL is one the server said it retrieved
 * (`allowed`) — anything else the model might have invented is shown as plain text.
 */
function inline(text: string, allowed: Set<string>, onNavigate: () => void, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      const url = m[2];
      if (allowed.has(url)) {
        const external = /^https?:\/\//.test(url);
        out.push(
          external ? (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="ai-link">{m[1]}</a>
          ) : url.startsWith("/uploads/") ? (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="ai-link">{m[1]}</a>
          ) : (
            <Link key={key} href={url} onClick={onNavigate} className="ai-link">{m[1]}</Link>
          ),
        );
      } else out.push(m[1]);
    } else if (m[3] !== undefined) out.push(<strong key={key} className="font-semibold text-[var(--ai-text)]">{m[3]}</strong>);
    else if (m[4] !== undefined) out.push(<code key={key} className="rounded bg-white/8 px-1 py-0.5 text-[0.85em]">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AnswerMarkdown({ text, allowedUrls, onNavigate }: { text: string; allowedUrls: string[]; onNavigate: () => void }) {
  const allowed = new Set(allowedUrls);
  const blocks: { type: "p" | "ul" | "ol"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const kind = ul ? "ul" : ol ? "ol" : "p";
    const content = ul ? ul[1] : ol ? ol[1] : line.trim();
    const prev = blocks[blocks.length - 1];
    if (prev && prev.type === kind && prev.lines.length) prev.lines.push(content);
    else if (prev && prev.type === "p" && !prev.lines.length) {
      prev.type = kind;
      prev.lines.push(content);
    } else blocks.push({ type: kind, lines: [content] });
  }
  return (
    <div className="space-y-2.5">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, bi) =>
          b.type === "p" ? (
            <p key={bi}>
              {b.lines.map((l, li) => (
                <Fragment key={li}>
                  {li > 0 && <br />}
                  {inline(l, allowed, onNavigate, `${bi}-${li}`)}
                </Fragment>
              ))}
            </p>
          ) : b.type === "ul" ? (
            <ul key={bi} className="ai-list list-disc space-y-1 pl-5">
              {b.lines.map((l, li) => <li key={li}>{inline(l, allowed, onNavigate, `${bi}-${li}`)}</li>)}
            </ul>
          ) : (
            <ol key={bi} className="ai-list list-decimal space-y-1 pl-5">
              {b.lines.map((l, li) => <li key={li}>{inline(l, allowed, onNavigate, `${bi}-${li}`)}</li>)}
            </ol>
          ),
        )}
    </div>
  );
}
