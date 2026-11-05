"use client";

import { SingletonForm } from "@/components/admin/singleton-form";
import { ABOUT_FIELDS } from "@/lib/admin/resources";

export default function AboutPage() {
  return (
    <SingletonForm
      endpoint="/admin/profile"
      title="About me"
      description="The professional summary and highlights in the About section."
      fields={ABOUT_FIELDS}
      successText="About section saved"
    />
  );
}
