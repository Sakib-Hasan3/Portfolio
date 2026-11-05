"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { LANG_COOKIE } from "@/lib/i18n";

export function LangToggle() {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = lang === "en" ? "bn" : "en";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-60"
      aria-label={lang === "en" ? "বাংলায় দেখুন" : "Switch to English"}
      lang={next}
    >
      <Languages className="size-4" aria-hidden /> {t("lang.switch")}
    </button>
  );
}
