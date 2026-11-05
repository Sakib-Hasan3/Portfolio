"use client";

import { SingletonForm } from "@/components/admin/singleton-form";
import { PROFILE_FIELDS } from "@/lib/admin/resources";

export default function ProfilePage() {
  return (
    <SingletonForm
      endpoint="/admin/profile"
      title="Profile & hero"
      description="Your name, title, photo and the first thing visitors read."
      fields={PROFILE_FIELDS}
      successText="Profile saved — the site is updated"
    />
  );
}
