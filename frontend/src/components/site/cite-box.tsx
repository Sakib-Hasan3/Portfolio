"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CiteBox({ ieee, bib }: { ieee: string; bib: string }) {
  const [tab, setTab] = useState<"ieee" | "bibtex">("ieee");
  const [copied, setCopied] = useState(false);
  const text = tab === "ieee" ? ieee : bib;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Citation format">
        {(["ieee", "bibtex"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("rounded-md px-2.5 py-1 text-sm", tab === t ? "bg-surface-2 font-medium" : "text-muted hover:text-text")}
          >
            {t === "ieee" ? "IEEE" : "BibTeX"}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-quiet ml-auto !py-1 text-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard unavailable */
            }
          }}
        >
          {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words p-4 text-[13px] leading-relaxed text-muted">{text}</pre>
    </div>
  );
}
