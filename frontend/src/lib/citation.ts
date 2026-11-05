import type { Publication } from "@/lib/types";

/** "IEEE RAAICON 2025" already carries the year; don't print it twice. */
export function venueYear(venue: string, year: number): string {
  return venue.includes(String(year)) ? venue : `${venue}, ${year}`;
}

export function ieeeCitation(p: Publication, fallbackAuthor?: string): string {
  const authors = p.authors || fallbackAuthor;
  return `${authors ? `${authors}, ` : ""}"${p.title}," in ${p.venue}, ${p.year}${p.doi ? `, doi: ${p.doi}` : ""}.`;
}

export function bibtex(p: Publication, fallbackAuthor?: string): string {
  const first = (p.authors || fallbackAuthor || "author").split(/[ ,]+/).filter(Boolean).pop()?.toLowerCase().replace(/[^a-z]/g, "") || "author";
  const word = p.title.split(/[^A-Za-z]+/).find((w) => w.length > 3)?.toLowerCase() || "paper";
  const type = p.publication_type === "journal" ? "article" : "inproceedings";
  const lines = [
    `@${type}{${first}${p.year}${word},`,
    `  title     = {${p.title}},`,
    p.authors || fallbackAuthor ? `  author    = {${(p.authors || fallbackAuthor)!.replace(/,\s*/g, " and ")}},` : null,
    `  ${type === "article" ? "journal  " : "booktitle"} = {${p.venue}},`,
    `  year      = {${p.year}},`,
    p.doi ? `  doi       = {${p.doi}},` : null,
    p.external_url ? `  url       = {${p.external_url}},` : null,
    `}`,
  ];
  return lines.filter(Boolean).join("\n");
}
