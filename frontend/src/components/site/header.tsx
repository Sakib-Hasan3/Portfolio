"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function SiteHeader({ name, nav, resumeUrl }: { name: string; nav: NavItem[]; resumeUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 3).join("");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-200",
        scrolled ? "border-line bg-bg/80 backdrop-blur-md" : "border-transparent bg-bg",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-3" aria-label={`${name}, home`}>
          <span className="grid size-8 place-items-center rounded-lg bg-text font-display text-[13px] font-bold tracking-tight text-bg">
            {initials}
          </span>
          <span className="hidden font-display text-[15px] font-semibold tracking-tight sm:inline">{name}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {resumeUrl && (
            <a href={resumeUrl} className="btn btn-ghost hidden !py-1.5 text-sm md:inline-flex" download>
              CV
            </a>
          )}
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-16 h-[calc(100dvh-4rem)] border-t border-line bg-bg md:hidden"
          >
            <ul className="container-x flex flex-col py-4">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block border-b border-line py-4 font-display text-2xl" onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
              {resumeUrl && (
                <li className="pt-6">
                  <a href={resumeUrl} className="btn btn-primary" download>
                    Download CV
                  </a>
                </li>
              )}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
