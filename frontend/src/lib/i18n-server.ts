import "server-only";
import { cookies } from "next/headers";
import { type I18nKey, type Lang, LANG_COOKIE, isLang, translate } from "./i18n";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: (key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}
