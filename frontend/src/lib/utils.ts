import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function yearSpan(start: number | null | undefined, end: number | null | undefined, current = false): string {
  if (!start && !end) return "";
  if (current) return `${start ?? ""} – Present`;
  if (start && end && start !== end) return `${start} – ${end}`;
  return String(end ?? start);
}

/** Splits plain text into paragraphs; lines starting with "- " become list items. Never renders HTML. */
export function textBlocks(text: string | null | undefined): Array<{ type: "p"; text: string } | { type: "ul"; items: string[] }> {
  if (!text) return [];
  const blocks: Array<{ type: "p"; text: string } | { type: "ul"; items: string[] }> = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^[-*•]\s+/.test(l))) {
      blocks.push({ type: "ul", items: lines.map((l) => l.replace(/^[-*•]\s+/, "")) });
    } else {
      blocks.push({ type: "p", text: lines.join("\n") });
    }
  }
  return blocks;
}

export const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  in_progress: "In progress",
  maintained: "Maintained",
  archived: "Archived",
  prototype: "Prototype",
};

export function isVisible(visibility: Record<string, boolean> | undefined, key: string) {
  return visibility?.[key] !== false;
}
