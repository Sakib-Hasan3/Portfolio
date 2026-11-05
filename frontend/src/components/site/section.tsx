import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Editorial two-column section: the heading sits in a left rail on wide screens
 * and stays in view while the content scrolls past.
 */
export function Section({
  id,
  title,
  lede,
  children,
  className,
  aside,
}: {
  id: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("container-x border-t border-line py-16 md:py-24", className)}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <h2 id={`${id}-title`} className="text-3xl md:text-4xl">
              {title}
            </h2>
            {lede ? <p className="mt-4 max-w-sm text-muted">{lede}</p> : null}
            {aside}
          </div>
        </div>
        <Reveal className="min-w-0 lg:col-span-8">{children}</Reveal>
      </div>
    </section>
  );
}
