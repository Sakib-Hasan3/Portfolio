import type { SocialLink } from "@/lib/types";
import Link from "next/link";
import { SocialIcon } from "./icons";

export function SiteFooter({ name, text, links }: { name: string; text?: string | null; links: SocialLink[] }) {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-x flex flex-col gap-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {name}
          {text ? <span className="block text-faint sm:inline sm:before:content-['_—_']">{text}</span> : null}
        </p>
        <Link href="/cv" className="hover:text-text sm:ml-auto sm:mr-4">CV</Link>
        <ul className="flex items-center gap-2">
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={l.url}
                target={l.url.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="inline-flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-text"
                aria-label={l.label}
              >
                <SocialIcon platform={l.platform} className="size-[18px]" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
