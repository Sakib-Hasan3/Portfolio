"use client";

import {
  BookOpen, Briefcase, ExternalLink, FileText, FolderKanban, GraduationCap, Image as ImageIcon, Inbox, KeyRound,
  LayoutDashboard, Layers, Link2, LogOut, Menu, Settings, Sparkles, Trophy, UserRound, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-provider";
import { api } from "@/lib/admin/client";
import { cn } from "@/lib/utils";
import { Spinner } from "./ui";

type Admin = { id: number; email: string; full_name: string; role: string };
const AdminCtx = createContext<{ user: Admin | null; unread: number; refreshUnread: () => void }>({ user: null, unread: 0, refreshUnread: () => {} });
export const useAdmin = () => useContext(AdminCtx);

const NAV: { group: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { group: "", items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  {
    group: "Identity",
    items: [
      { href: "/admin/profile", label: "Profile & hero", icon: UserRound },
      { href: "/admin/about", label: "About me", icon: Sparkles },
      { href: "/admin/social-links", label: "Social links", icon: Link2 },
      { href: "/admin/resume", label: "CV / resume", icon: FileText },
    ],
  },
  {
    group: "Content",
    items: [
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
      { href: "/admin/publications", label: "Publications", icon: BookOpen },
      { href: "/admin/skills", label: "Skills", icon: Layers },
      { href: "/admin/skill-categories", label: "Skill categories", icon: Layers },
      { href: "/admin/experience", label: "Experience", icon: Briefcase },
      { href: "/admin/education", label: "Education", icon: GraduationCap },
      { href: "/admin/achievements", label: "Achievements", icon: Trophy },
    ],
  },
  {
    group: "Site",
    items: [
      { href: "/admin/messages", label: "Messages", icon: Inbox },
      { href: "/admin/media", label: "Media library", icon: ImageIcon },
      { href: "/admin/settings", label: "Website settings", icon: Settings },
      { href: "/admin/account", label: "Account & security", icon: KeyRound },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Admin | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refreshUnread = useCallback(() => {
    api<{ count: number }>("/admin/messages/unread-count").then((r) => setUnread(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    api<Admin>("/auth/me").then(setUser).catch(() => {});
    refreshUnread();
    const t = setInterval(refreshUnread, 60_000);
    return () => clearInterval(t);
  }, [refreshUnread]);
  useEffect(() => setOpen(false), [pathname]);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  };

  if (!user) {
    return <div className="grid min-h-dvh place-items-center text-muted"><Spinner className="size-6" /></div>;
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/"));

  const sidebar = (
    <nav aria-label="Dashboard" className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin" className="font-display text-[15px] font-semibold">Portfolio CMS</Link>
        <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group} className="mt-4 first:mt-0">
            {g.group && <p className="px-2 pb-1.5 text-xs text-faint">{g.group}</p>}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={isActive(it.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      isActive(it.href) ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2/60 hover:text-text",
                    )}
                  >
                    <it.icon className="size-4" />
                    <span className="flex-1">{it.label}</span>
                    {it.href === "/admin/messages" && unread > 0 && (
                      <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">{unread}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-surface-2/60 hover:text-text">
          <ExternalLink className="size-4" /> View public site
        </a>
        <div className="mt-2 flex items-center gap-2 px-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.full_name}</p>
            <p className="truncate text-xs text-faint">{user.email}</p>
          </div>
          <ThemeToggle />
          <button type="button" onClick={logout} className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <AdminCtx.Provider value={{ user, unread, refreshUnread }}>
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">{sidebar}</aside>
          </div>
        )}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-2"><Menu className="size-5" /></button>
            <span className="font-display font-semibold">Portfolio CMS</span>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
