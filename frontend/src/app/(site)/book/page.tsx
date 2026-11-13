import type { Metadata } from "next";
import { BookMeeting } from "@/components/site/booking";
import { ContentUnavailable } from "@/components/site/states";
import { getPortfolioSafe } from "@/lib/api/server";
import { baseMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolioSafe();
  const name = data?.profile?.full_name ?? "Portfolio";
  return baseMetadata(data, { title: `Book a meeting — ${name}`, description: `Pick a date and time to book a call with ${name}.`, path: "/book" });
}

export default async function BookPage() {
  const data = await getPortfolioSafe();
  if (!data || !data.profile) return <ContentUnavailable />;
  const enabled = data.settings?.contact_form_enabled ?? true;
  return (
    <div className="pt-6 md:pt-10">
      <BookMeeting name={data.profile.full_name} enabled={enabled} />
      {!enabled && (
        <p className="container-x py-16 text-muted">Booking is turned off right now. Please use the email on the home page instead.</p>
      )}
    </div>
  );
}
