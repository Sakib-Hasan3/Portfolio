"use client";

import Link from "next/link";
import { FileDown, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { Portfolio } from "@/lib/types";
import { HeroVisual } from "./hero-visual";
import { SocialIcon } from "./icons";

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false, loading: () => null });

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, ease: EASE, delay },
});

export function Hero({ data }: { data: Portfolio }) {
  const p = data.profile!;
  const heroLinks = data.social_links.filter((l) => l.show_in_hero);

  return (
    <section className="relative container-x pb-16 pt-10 md:pb-24 md:pt-16 overflow-hidden" aria-labelledby="hero-title">
      <HeroScene />
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="relative z-10 lg:col-span-7">
          <motion.div {...fadeUp(0)} className="flex items-center gap-4">
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={`Portrait of ${p.full_name}`}
                width={72}
                height={72}
                className="size-[72px] rounded-2xl border border-line object-cover object-[50%_30%]"
                fetchPriority="high"
              />
            ) : null}
            <div className="text-sm">
              {p.location ? (
                <p className="flex items-center gap-1.5 text-muted">
                  <MapPin className="size-3.5" aria-hidden /> {p.location}
                </p>
              ) : null}
              {p.available_for_work ? (
                <p className="mt-1 flex items-center gap-2 text-text">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-40 motion-reduce:hidden" />
                    <span className="relative inline-flex size-2 rounded-full bg-ok" />
                  </span>
                  Available for new work
                </p>
              ) : null}
            </div>
          </motion.div>

          <motion.h1 {...fadeUp(0.1)} id="hero-title" className="mt-8 text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            {p.full_name}
          </motion.h1>
          <motion.p {...fadeUp(0.2)} className="mt-5 font-display text-xl text-text md:text-2xl">
            {p.title}
            {p.specialties.length > 0 && (
              <span className="mt-1 block text-lg text-muted md:text-xl">{p.specialties.join(" / ")}</span>
            )}
          </motion.p>

          {p.hero_headline ? <motion.p {...fadeUp(0.3)} className="mt-8 max-w-[36ch] text-balance text-xl leading-snug md:text-2xl">{p.hero_headline}</motion.p> : null}
          {p.hero_description ? <motion.p {...fadeUp(0.35)} className="mt-4 max-w-[60ch] text-muted">{p.hero_description}</motion.p> : null}

          <motion.div {...fadeUp(0.45)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/#projects" className="btn btn-primary">
              View my projects
            </Link>
            {data.resume ? (
              <a href={data.resume.file_url} className="btn btn-ghost" download>
                <FileDown className="size-4" aria-hidden /> Download CV
              </a>
            ) : null}
            <Link href="/#contact" className="btn btn-quiet">
              Contact me
            </Link>
            {heroLinks.length > 0 && <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />}
            {heroLinks.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label={l.label}
              >
                <SocialIcon platform={l.platform} className="size-5" />
              </a>
            ))}
          </motion.div>
        </div>

        {data.skills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
            className="relative z-10 lg:col-span-5"
          >
            <HeroVisual categories={data.skills} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
