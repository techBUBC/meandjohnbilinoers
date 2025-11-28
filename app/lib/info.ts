import { createServerClient } from "@/lib/supabase/server";

export type InfoItem = {
  id: string;
  user_id: string;
  label: string;
  value: string;
  created_at: string;
  updated_at: string;
};

export async function rememberInfo(opts: {
  userId: string;
  label: string;
  value: string;
}): Promise<InfoItem> {
  const supabase = createServerClient();
  const { userId, label, value } = opts;
  const { data, error } = await supabase
    .from("info_items")
    .upsert(
      {
        user_id: userId,
        label,
        value,
      },
      { onConflict: "user_id,label" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as InfoItem;
}

export async function lookupInfo(opts: {
  userId: string;
  label: string;
}): Promise<InfoItem | null> {
  const supabase = createServerClient();
  const { userId, label } = opts;
  const { data, error } = await supabase
    .from("info_items")
    .select("*")
    .eq("user_id", userId)
    .ilike("label", label)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && (error as any).code !== "PGRST116") throw error;
  return (data as InfoItem) ?? null;
}
