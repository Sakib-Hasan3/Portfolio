"use client";

import { Printer } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export function PrintButton() {
  const t = useT();
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
      <Printer className="size-4" aria-hidden /> {t("cv.print")}
    </button>
  );
}
