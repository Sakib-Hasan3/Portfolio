"use client";

import { SingletonForm } from "@/components/admin/singleton-form";
import { SETTINGS_FIELDS } from "@/lib/admin/resources";

export default function SettingsPage() {
  return (
    <SingletonForm
      endpoint="/admin/settings"
      title="Website settings"
      description="SEO, which sections appear, the contact form and privacy-friendly analytics."
      fields={SETTINGS_FIELDS}
      successText="Settings saved"
    />
  );
}
