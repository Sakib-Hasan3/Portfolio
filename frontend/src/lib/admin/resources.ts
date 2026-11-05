/**
 * Declarative definitions for every CRUD module in the dashboard. The list
 * table, filters and form (with zod validation) are all generated from these.
 */

export type FieldType =
  | "text" | "textarea" | "markdown" | "number" | "boolean" | "select" | "url" | "slug"
  | "tags" | "list" | "image" | "pdf" | "relation" | "links" | "gallery" | "icon" | "visibility";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  relation?: { resource: string; labelKey: string };
  min?: number;
  max?: number;
  maxLength?: number;
  rows?: number;
  purpose?: string; // upload purpose
  span?: 1 | 2;
  defaultValue?: unknown;
  section?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  kind?: "text" | "badge" | "bool" | "image" | "list" | "relation";
  relation?: { resource: string; labelKey: string };
}

export interface FilterDef {
  name: string;
  label: string;
  options?: { value: string; label: string }[];
  relation?: { resource: string; labelKey: string };
  kind?: "bool";
}

export interface ResourceDef {
  name: string; // API segment
  label: string;
  plural: string;
  description: string;
  titleKey: string;
  subtitleKey?: string;
  publishable: boolean;
  softDelete?: boolean;
  fields: FieldDef[];
  columns: ColumnDef[];
  filters: FilterDef[];
  searchPlaceholder: string;
}

const PUBLISH: FieldDef[] = [
  { name: "is_published", label: "Published", type: "boolean", defaultValue: true, help: "Only published items appear on the public site.", section: "Visibility" },
  { name: "sort_order", label: "Sort order", type: "number", min: 0, defaultValue: 0, help: "Lower numbers appear first.", section: "Visibility" },
];

const publishedFilter: FilterDef = {
  name: "is_published",
  label: "Status",
  kind: "bool",
  options: [{ value: "true", label: "Published" }, { value: "false", label: "Draft" }],
};

const year = (name: string, label: string, required = false): FieldDef => ({ name, label, type: "number", min: 1950, max: 2100, required });

export const RESOURCES: Record<string, ResourceDef> = {
  projects: {
    name: "projects",
    label: "Project",
    plural: "Projects",
    description: "Case studies shown in the Projects section and on their own pages.",
    titleKey: "title",
    subtitleKey: "category",
    publishable: true,
    softDelete: true,
    searchPlaceholder: "Search title, description or technology",
    columns: [
      { key: "thumbnail_url", label: "", kind: "image" },
      { key: "title", label: "Title" },
      { key: "category", label: "Category", kind: "badge" },
      { key: "year", label: "Year" },
      { key: "is_featured", label: "Featured", kind: "bool" },
    ],
    filters: [
      publishedFilter,
      { name: "is_featured", label: "Featured", kind: "bool", options: [{ value: "true", label: "Featured" }, { value: "false", label: "Not featured" }] },
      {
        name: "status",
        label: "Project status",
        options: [
          { value: "completed", label: "Completed" }, { value: "in_progress", label: "In progress" },
          { value: "maintained", label: "Maintained" }, { value: "prototype", label: "Prototype" }, { value: "archived", label: "Archived" },
        ],
      },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, maxLength: 240, span: 2, section: "Basics" },
      { name: "slug", label: "URL slug", type: "slug", help: "Leave empty to generate from the title.", section: "Basics" },
      { name: "category", label: "Category", type: "text", required: true, maxLength: 80, placeholder: "e.g. Computer Vision", section: "Basics" },
      { name: "short_description", label: "Short description", type: "textarea", required: true, maxLength: 500, rows: 3, span: 2, help: "Shown on project cards.", section: "Basics" },
      { name: "description", label: "Detailed description", type: "markdown", rows: 14, maxLength: 20000, span: 2, help: "Markdown supported: # headings, **bold**, lists, tables, code blocks, links and images. Type here, paste, or upload a .md file.", section: "Details" },
      { name: "highlights", label: "Highlights", type: "list", span: 2, help: "One point per line.", section: "Details" },
      { name: "technologies", label: "Technologies", type: "tags", span: 2, help: "Press Enter or comma after each.", section: "Details" },
      {
        name: "status", label: "Project status", type: "select", defaultValue: "completed", section: "Details",
        options: [
          { value: "completed", label: "Completed" }, { value: "in_progress", label: "In progress" },
          { value: "maintained", label: "Maintained" }, { value: "prototype", label: "Prototype" }, { value: "archived", label: "Archived" },
        ],
      },
      { ...year("year", "Year"), section: "Details" },
      { name: "period_label", label: "Period label", type: "text", placeholder: "e.g. 2022–2023", maxLength: 40, help: "Optional; overrides the year on cards.", section: "Details" },
      { name: "publication_id", label: "Related publication", type: "relation", relation: { resource: "publications", labelKey: "title" }, section: "Details" },
      { name: "thumbnail_url", label: "Thumbnail", type: "image", purpose: "project-thumbnail", span: 2, section: "Media" },
      { name: "images", label: "Screenshots", type: "gallery", purpose: "project-screenshot", span: 2, section: "Media" },
      { name: "github_url", label: "GitHub URL", type: "url", section: "Links" },
      { name: "demo_url", label: "Live demo URL", type: "url", section: "Links" },
      { name: "extra_links", label: "Other links", type: "links", span: 2, section: "Links" },
      { name: "is_featured", label: "Featured", type: "boolean", defaultValue: false, help: "Featured projects lead the home page.", section: "Visibility" },
      ...PUBLISH,
    ],
  },

  publications: {
    name: "publications",
    label: "Publication",
    plural: "Publications",
    description: "Papers listed in Research & publications.",
    titleKey: "title",
    subtitleKey: "venue",
    publishable: true,
    softDelete: true,
    searchPlaceholder: "Search title, venue or DOI",
    columns: [
      { key: "title", label: "Title" },
      { key: "venue", label: "Venue" },
      { key: "year", label: "Year" },
      { key: "author_position", label: "Role" },
    ],
    filters: [
      publishedFilter,
      {
        name: "publication_type", label: "Type",
        options: ["conference", "journal", "preprint", "workshop", "thesis", "other"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
      },
    ],
    fields: [
      { name: "title", label: "Paper title", type: "text", required: true, maxLength: 400, span: 2, section: "Paper" },
      { name: "slug", label: "URL slug", type: "slug", help: "Leave empty to generate from the title.", section: "Paper" },
      {
        name: "publication_type", label: "Type", type: "select", defaultValue: "conference", section: "Paper",
        options: ["conference", "journal", "preprint", "workshop", "thesis", "other"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
      },
      { name: "venue", label: "Conference or journal", type: "text", required: true, maxLength: 300, placeholder: "e.g. IEEE WIECON-ECE 2025", section: "Paper" },
      { ...year("year", "Year", true), section: "Paper" },
      { name: "author_position", label: "Author position", type: "text", maxLength: 80, placeholder: "e.g. First author", section: "Paper" },
      { name: "authors", label: "Author list", type: "text", maxLength: 2000, placeholder: "M. S. Hasan, A. Author, B. Author", help: "Used for the copied citation.", section: "Paper" },
      { name: "doi", label: "DOI", type: "text", maxLength: 200, placeholder: "10.1109/…", help: "Without the https://doi.org/ prefix.", section: "Paper" },
      { name: "abstract", label: "Abstract", type: "textarea", rows: 6, maxLength: 10000, span: 2, section: "Content" },
      { name: "highlights", label: "Key points", type: "list", span: 2, help: "One point per line.", section: "Content" },
      { name: "tags", label: "Topics", type: "tags", span: 2, section: "Content" },
      { name: "pdf_url", label: "PDF", type: "pdf", purpose: "publication-pdf", span: 2, section: "Files & links" },
      { name: "external_url", label: "Publisher page URL", type: "url", span: 2, section: "Files & links" },
      ...PUBLISH,
    ],
  },

  "skill-categories": {
    name: "skill-categories",
    label: "Skill category",
    plural: "Skill categories",
    description: "Groups that organise your skills (and the clusters in the hero).",
    titleKey: "name",
    publishable: true,
    searchPlaceholder: "Search categories",
    columns: [
      { key: "name", label: "Name" },
      { key: "skill_count", label: "Skills" },
      { key: "sort_order", label: "Order" },
    ],
    filters: [publishedFilter],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, maxLength: 120 },
      { name: "slug", label: "Slug", type: "slug", help: "Leave empty to generate from the name." },
      { name: "icon", label: "Icon", type: "icon" },
      { name: "description", label: "Description", type: "textarea", rows: 3, maxLength: 1000, span: 2 },
      ...PUBLISH,
    ],
  },

  skills: {
    name: "skills",
    label: "Skill",
    plural: "Skills",
    description: "Individual skills, each inside a category.",
    titleKey: "name",
    subtitleKey: "category_name",
    publishable: true,
    searchPlaceholder: "Search skills",
    columns: [
      { key: "name", label: "Skill" },
      { key: "category_name", label: "Category", kind: "badge" },
      { key: "sort_order", label: "Order" },
    ],
    filters: [publishedFilter, { name: "category_id", label: "Category", relation: { resource: "skill-categories", labelKey: "name" } }],
    fields: [
      { name: "name", label: "Skill", type: "text", required: true, maxLength: 120 },
      { name: "category_id", label: "Category", type: "relation", required: true, relation: { resource: "skill-categories", labelKey: "name" } },
      { name: "proficiency", label: "Proficiency (1–5)", type: "number", min: 1, max: 5, help: "Optional. Not shown publicly by default." },
      ...PUBLISH,
    ],
  },

  education: {
    name: "education",
    label: "Education",
    plural: "Education",
    description: "Degrees and academic programmes.",
    titleKey: "degree",
    subtitleKey: "institution",
    publishable: true,
    searchPlaceholder: "Search degree or institution",
    columns: [
      { key: "degree", label: "Degree" },
      { key: "institution", label: "Institution" },
      { key: "end_year", label: "Year" },
      { key: "grade", label: "Grade" },
    ],
    filters: [publishedFilter],
    fields: [
      { name: "degree", label: "Degree", type: "text", required: true, maxLength: 200, placeholder: "Bachelor of Science" },
      { name: "field_of_study", label: "Field of study", type: "text", maxLength: 200 },
      { name: "institution", label: "Institution", type: "text", required: true, maxLength: 240, span: 2 },
      { name: "location", label: "Location", type: "text", maxLength: 160 },
      { name: "grade", label: "Grade", type: "text", maxLength: 80, placeholder: "CGPA 3.56" },
      year("start_year", "Start year"),
      year("end_year", "End year"),
      { name: "is_expected", label: "End year is expected graduation", type: "boolean", defaultValue: false },
      { name: "description", label: "Description", type: "textarea", rows: 4, maxLength: 4000, span: 2 },
      { name: "highlights", label: "Highlights", type: "list", span: 2, help: "Coursework, thesis, honours — one per line." },
      ...PUBLISH,
    ],
  },

  experience: {
    name: "experience",
    label: "Experience",
    plural: "Experience",
    description: "Roles, leadership and work history for the timeline.",
    titleKey: "role",
    subtitleKey: "organization",
    publishable: true,
    searchPlaceholder: "Search role or organisation",
    columns: [
      { key: "role", label: "Role" },
      { key: "organization", label: "Organisation" },
      { key: "start_year", label: "From" },
      { key: "is_current", label: "Current", kind: "bool" },
    ],
    filters: [publishedFilter, { name: "is_current", label: "Current", kind: "bool", options: [{ value: "true", label: "Current" }, { value: "false", label: "Past" }] }],
    fields: [
      { name: "role", label: "Role", type: "text", required: true, maxLength: 200, span: 2 },
      { name: "organization", label: "Organisation", type: "text", required: true, maxLength: 240 },
      { name: "employment_type", label: "Type", type: "text", maxLength: 80, placeholder: "Full-time, Leadership, Volunteer…" },
      { name: "location", label: "Location", type: "text", maxLength: 160, placeholder: "Remote" },
      year("start_year", "Start year", true),
      year("end_year", "End year"),
      { name: "is_current", label: "I currently hold this role", type: "boolean", defaultValue: false },
      { name: "description", label: "Description", type: "textarea", rows: 3, maxLength: 4000, span: 2 },
      { name: "highlights", label: "Responsibilities & outcomes", type: "list", span: 2, help: "One per line." },
      ...PUBLISH,
    ],
  },

  testimonials: {
    name: "testimonials",
    label: "Testimonial",
    plural: "Testimonials",
    description: "Quotes from supervisors, teammates or clients. Only add words the person actually said or wrote. The section is hidden while this is empty.",
    titleKey: "author_name",
    subtitleKey: "organization",
    publishable: true,
    searchPlaceholder: "Search testimonials",
    columns: [
      { key: "author_name", label: "Name" },
      { key: "organization", label: "Organisation" },
      { key: "relationship", label: "Relationship" },
    ],
    filters: [publishedFilter],
    fields: [
      { name: "author_name", label: "Name", type: "text", required: true, maxLength: 120 },
      { name: "relationship", label: "Relationship", type: "text", maxLength: 80, placeholder: "Supervisor, Teammate, Client…" },
      { name: "author_role", label: "Their role", type: "text", maxLength: 160 },
      { name: "organization", label: "Organisation", type: "text", maxLength: 200 },
      { name: "quote", label: "Quote", type: "textarea", required: true, rows: 5, maxLength: 2000, span: 2 },
      { name: "source_url", label: "Source link", type: "url", span: 2, help: "Optional: e.g. the LinkedIn recommendation, so visitors can verify it." },
      { name: "avatar_url", label: "Photo", type: "image", purpose: "avatar", span: 2 },
      ...PUBLISH,
    ],
  },

  notes: {
    name: "notes",
    label: "Note",
    plural: "Notes",
    description: "Technical write-ups shown under /notes. Write in Markdown or upload a .md file.",
    titleKey: "title",
    subtitleKey: "summary",
    publishable: true,
    searchPlaceholder: "Search notes",
    columns: [
      { key: "title", label: "Title" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    filters: [publishedFilter],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, maxLength: 240, span: 2, section: "Basics" },
      { name: "slug", label: "URL slug", type: "slug", span: 2, help: "Leave empty to generate it from the title.", section: "Basics" },
      { name: "summary", label: "Summary", type: "textarea", rows: 3, maxLength: 500, span: 2, help: "Shown on cards and in link previews.", section: "Basics" },
      { name: "tags", label: "Tags", type: "tags", span: 2, section: "Basics" },
      { name: "content", label: "Content", type: "markdown", rows: 22, maxLength: 60000, span: 2, help: "Markdown supported. Type, paste, or upload a .md file.", section: "Write" },
      { name: "cover_url", label: "Cover image", type: "image", purpose: "note-cover", span: 2, section: "Media" },
      ...PUBLISH,
    ],
  },

  achievements: {
    name: "achievements",
    label: "Achievement",
    plural: "Achievements",
    description: "Awards, certifications and other recognition. The section is hidden while this is empty.",
    titleKey: "title",
    subtitleKey: "issuer",
    publishable: true,
    searchPlaceholder: "Search achievements",
    columns: [
      { key: "title", label: "Title" },
      { key: "issuer", label: "Issuer" },
      { key: "year", label: "Year" },
    ],
    filters: [publishedFilter],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, maxLength: 240, span: 2 },
      { name: "issuer", label: "Issued by", type: "text", maxLength: 240 },
      year("year", "Year"),
      { name: "url", label: "Link", type: "url", span: 2 },
      { name: "description", label: "Description", type: "textarea", rows: 3, maxLength: 4000, span: 2 },
      ...PUBLISH,
    ],
  },

  "social-links": {
    name: "social-links",
    label: "Social link",
    plural: "Social links",
    description: "Profiles linked from the hero, contact section and footer.",
    titleKey: "label",
    subtitleKey: "url",
    publishable: true,
    searchPlaceholder: "Search links",
    columns: [
      { key: "label", label: "Label" },
      { key: "platform", label: "Platform", kind: "badge" },
      { key: "url", label: "URL" },
      { key: "show_in_hero", label: "In hero", kind: "bool" },
    ],
    filters: [publishedFilter],
    fields: [
      {
        name: "platform", label: "Platform", type: "select", required: true, defaultValue: "github",
        options: ["github", "linkedin", "email", "google-scholar", "orcid", "researchgate", "kaggle", "x", "website", "other"].map((v) => ({ value: v, label: v })),
      },
      { name: "label", label: "Label", type: "text", required: true, maxLength: 120 },
      { name: "url", label: "URL", type: "text", required: true, maxLength: 1024, span: 2, help: "https://… or mailto:you@example.com" },
      { name: "show_in_hero", label: "Show as an icon in the hero", type: "boolean", defaultValue: false },
      ...PUBLISH,
    ],
  },
};

export const ICON_OPTIONS = [
  "code", "globe", "brain", "scan-eye", "message-square-text", "sparkles", "database", "cpu",
  "layers", "server", "smartphone", "network", "bot", "workflow", "terminal", "atom",
];

// ------------------------------------------------------------------ singletons

export const PROFILE_FIELDS: FieldDef[] = [
  { name: "full_name", label: "Full name", type: "text", required: true, maxLength: 120, section: "Identity" },
  { name: "title", label: "Professional title", type: "text", required: true, maxLength: 160, placeholder: "AI/ML Engineer", section: "Identity" },
  { name: "specialties", label: "Specialties", type: "tags", help: "Shown under your title and as clusters in the Open Graph card.", section: "Identity" },
  { name: "avatar_url", label: "Profile picture", type: "image", purpose: "avatar", section: "Identity" },
  { name: "hero_headline", label: "Headline", type: "textarea", rows: 2, maxLength: 240, span: 2, section: "Hero" },
  { name: "hero_description", label: "Supporting description", type: "textarea", rows: 3, maxLength: 2000, span: 2, section: "Hero" },
  { name: "location", label: "Location", type: "text", maxLength: 160, section: "Contact details" },
  { name: "email", label: "Public email", type: "text", maxLength: 255, section: "Contact details" },
  { name: "phone", label: "Phone", type: "text", maxLength: 40, section: "Contact details" },
  { name: "show_phone", label: "Show phone number publicly", type: "boolean", section: "Contact details" },
  { name: "available_for_work", label: "Show “Available for new work”", type: "boolean", section: "Availability" },
  { name: "availability_note", label: "Availability note", type: "text", maxLength: 240, span: 2, help: "Shown in the contact section.", section: "Availability" },
];

export const ABOUT_FIELDS: FieldDef[] = [
  { name: "about_title", label: "Section title", type: "text", maxLength: 160 },
  { name: "about_summary", label: "Professional summary", type: "textarea", rows: 10, maxLength: 8000, span: 2, help: "Blank lines start new paragraphs." },
  { name: "about_highlights", label: "Highlights", type: "list", span: 2, help: "One per line — shown as a checklist under the summary." },
];

export const SECTIONS = ["about", "research", "projects", "skills", "experience", "education", "achievements", "contact"];

export const SETTINGS_FIELDS: FieldDef[] = [
  { name: "site_title", label: "Site title", type: "text", required: true, maxLength: 160, span: 2, help: "Browser tab and search results.", section: "SEO" },
  { name: "site_description", label: "Meta description", type: "textarea", rows: 2, maxLength: 400, span: 2, section: "SEO" },
  { name: "site_url", label: "Public site URL", type: "url", help: "Used for canonical links and the sitemap.", section: "SEO" },
  { name: "keywords", label: "Keywords", type: "tags", section: "SEO" },
  { name: "og_image_url", label: "Social share image", type: "image", purpose: "og-image", help: "Optional. A card is generated automatically if empty.", section: "SEO" },
  { name: "section_visibility", label: "Sections on the home page", type: "visibility", span: 2, section: "Layout" },
  { name: "footer_text", label: "Footer text", type: "text", maxLength: 300, span: 2, section: "Layout" },
  { name: "contact_form_enabled", label: "Contact form enabled", type: "boolean", section: "Contact" },
  { name: "notify_on_contact", label: "Email me about new messages", type: "boolean", help: "Requires SMTP settings on the server.", section: "Contact" },
  {
    name: "analytics_provider", label: "Analytics", type: "select", section: "Analytics",
    options: [{ value: "", label: "Off" }, { value: "plausible", label: "Plausible (cookieless)" }, { value: "umami", label: "Umami (cookieless)" }],
  },
  { name: "analytics_site_id", label: "Site ID / domain", type: "text", maxLength: 200, help: "Plausible: your domain. Umami: the website ID.", section: "Analytics" },
  { name: "analytics_script_url", label: "Script URL (self-hosted)", type: "url", help: "Leave empty for the provider's cloud script.", section: "Analytics" },
];
