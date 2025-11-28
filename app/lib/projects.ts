import { createServerClient } from "@/lib/supabase/server";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  area: string | null;
  notes: string | null;
  is_archived: boolean;
};

function projectSelect() {
  return ["id", "user_id", "name", "area", "notes", "is_archived"];
}

export async function getProjectByName(params: {
  userId: string;
  name: string;
}): Promise<Project | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(projectSelect().join(","))
    .eq("user_id", params.userId)
    .ilike("name", params.name)
    .maybeSingle();

  if (error) {
    console.error("[projects] getProjectByName error:", error);
    return null;
  }
  return data ? (data as unknown as Project) : null;
}

export async function createOrGetProject(params: {
  userId: string;
  name: string;
  area?: string | null;
}): Promise<Project> {
  const existing = await getProjectByName({ userId: params.userId, name: params.name });
  if (existing) return existing;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: params.userId,
      name: params.name,
      area: params.area ?? null,
    })
    .select(projectSelect().join(","))
    .single();

  if (error) {
    console.error("[projects] createOrGetProject error:", error);
    throw error;
  }
  return data as unknown as Project;
}

export async function archiveProject(params: {
  userId: string;
  projectId: string;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("projects")
    .update({ is_archived: true })
    .eq("user_id", params.userId)
    .eq("id", params.projectId);

  if (error) {
    console.error("[projects] archiveProject error:", error);
    throw error;
  }
}

export async function moveTasksToProject(params: {
  userId: string;
  fromProjectName: string;
  toProjectName: string;
}): Promise<{ movedCount: number }> {
  const supabase = createServerClient();
  const fromProject = await getProjectByName({
    userId: params.userId,
    name: params.fromProjectName,
  });
  const toProject = await getProjectByName({
    userId: params.userId,
    name: params.toProjectName,
  });

  if (!fromProject || !toProject) {
    return { movedCount: 0 };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ project_id: toProject.id })
    .eq("user_id", params.userId)
    .eq("project_id", fromProject.id)
    .select("id");

  if (error) {
    console.error("[projects] moveTasksToProject error:", error);
    throw error;
  }

  return { movedCount: data?.length ?? 0 };
}
