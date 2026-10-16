export type Project = {
  id: string; slug: string; title: string; subtitle: string | null;
  location: string | null; hero_image_url: string | null;
  status: "draft" | "active" | "archived"; created_at: string; updated_at: string;
};
export type Offering = {
  id: string; project_id: string; offering_type: "sale" | "rental" | "investment" | "financing";
  title: string | null; summary: string | null;
  status: "draft" | "active" | "archived"; created_at: string; updated_at: string;
};
export type TextBlock = {
  id: string; project_id: string; block_type: string;
  content: { heading?: string; body?: string } | null;
  position: number; is_visible: boolean; updated_at: string;
};
export type ProjectDocument = {
  id: string; project_id: string; offering_id: string | null;
  file_path: string; title: string; description: string | null;
  category: string; mime_type: string; file_size_bytes: number;
  is_published: boolean; position: number; created_at: string;
};
export type Member = {
  id: string; full_name: string | null; email: string;
  role: string; is_active: boolean;
};
export type ProjectGrant = { user_id: string; project_id: string; granted_at: string };
export type OfferingGrant = { user_id: string; offering_id: string; granted_at: string };
export type CockpitData = {
  project: Project; offerings: Offering[]; blocks: TextBlock[];
  documents: ProjectDocument[]; members: Member[];
  projectGrants: ProjectGrant[]; offeringGrants: OfferingGrant[];
};
export const offeringNames: Record<string, string> = {
  sale: "Private Sale", investment: "Investment",
  rental: "Private Rental", financing: "Private Capital",
};
export const statuses = ["draft", "active", "archived"] as const;
export const STAGING_URL = "https://senonkpxdtlhyhrubicg.supabase.co";
