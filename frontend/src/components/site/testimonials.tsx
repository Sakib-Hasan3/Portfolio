"use client";

import { Quote } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import type { Testimonial } from "@/lib/types";
import { Section } from "./section";
import { Tilt } from "./tilt";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function Testimonials({ items }: { items: Testimonial[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <Section id="testimonials" title={t("sec.testimonials")} lede={t("sec.testimonials.lede")}>
      <ul className="grid gap-5 md:grid-cols-2">
        {items.map((x) => (
          <li key={x.id}>
            <Tilt className="rounded-2xl">
              <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                <Quote className="size-6 text-accent" aria-hidden />
                <blockquote className="mt-4 flex-1 text-[1.02rem] leading-relaxed text-text">“{x.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-4">
                  {x.avatar_url ? (
                    <img src={x.avatar_url} alt="" width={44} height={44} loading="lazy" className="size-11 rounded-full border border-line object-cover" />
                  ) : (
                    <span aria-hidden className="grid size-11 place-items-center rounded-full bg-accent-soft font-display text-sm font-semibold text-accent">{initials(x.author_name)}</span>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-text">
                      {x.source_url ? (
                        <a href={x.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{x.author_name}</a>
                      ) : x.author_name}
                    </p>
                    <p className="truncate text-muted">{[x.author_role, x.organization].filter(Boolean).join(", ")}</p>
                    {x.relationship && <p className="text-xs text-faint">{x.relationship}</p>}
                  </div>
                </figcaption>
              </figure>
            </Tilt>
          </li>
        ))}
      </ul>
    </Section>
  );
}
