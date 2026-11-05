export interface Profile {
  full_name: string;
  title: string;
  specialties: string[];
  hero_headline: string;
  hero_description: string;
  about_title: string;
  about_summary: string;
  about_highlights: string[];
  location: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  available_for_work: boolean;
  availability_note: string | null;
}

export interface SiteSettings {
  site_title: string;
  site_description: string;
  site_url: string | null;
  keywords: string[];
  og_image_url: string | null;
  footer_text: string | null;
  section_visibility: Record<string, boolean>;
  analytics_provider: "plausible" | "umami" | null;
  analytics_site_id: string | null;
  analytics_script_url: string | null;
  contact_form_enabled: boolean;
}

export interface SocialLink {
  id: number;
  platform: string;
  label: string;
  url: string;
  show_in_hero: boolean;
}

export interface Skill {
  id: number;
  name: string;
  icon: string | null;
  proficiency: number | null;
}

export interface SkillCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  skills: Skill[];
}

export interface Publication {
  id: number;
  title: string;
  slug: string;
  abstract: string | null;
  highlights: string[];
  authors: string | null;
  author_position: string | null;
  venue: string;
  publication_type: string;
  year: number;
  doi: string | null;
  doi_url: string | null;
  pdf_url: string | null;
  external_url: string | null;
  tags: string[];
}

export interface ProjectImage {
  id: number;
  url: string;
  caption: string | null;
  sort_order: number;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  short_description: string;
  description: string | null;
  highlights: string[];
  technologies: string[];
  category: string;
  status: string;
  year: number | null;
  period_label: string | null;
  thumbnail_url: string | null;
  github_url: string | null;
  demo_url: string | null;
  extra_links: { label: string; url: string }[];
  is_featured: boolean;
  images: ProjectImage[];
  publication: { id: number; title: string; slug: string; venue: string; year: number; doi: string | null } | null;
}

export interface Education {
  id: number;
  degree: string;
  field_of_study: string | null;
  institution: string;
  location: string | null;
  start_year: number | null;
  end_year: number | null;
  is_expected: boolean;
  grade: string | null;
  description: string | null;
  highlights: string[];
}

export interface Experience {
  id: number;
  role: string;
  organization: string;
  location: string | null;
  employment_type: string | null;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
  description: string | null;
  highlights: string[];
}

export interface Achievement {
  id: number;
  title: string;
  issuer: string | null;
  year: number | null;
  description: string | null;
  url: string | null;
}

export interface Portfolio {
  profile: Profile | null;
  settings: SiteSettings | null;
  social_links: SocialLink[];
  skills: SkillCategory[];
  publications: Publication[];
  projects: Project[];
  education: Education[];
  experience: Experience[];
  achievements: Achievement[];
  resume: { title: string; file_url: string; updated_at: string } | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
