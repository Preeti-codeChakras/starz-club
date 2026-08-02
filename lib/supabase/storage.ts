import { supabase } from "./client";
import { v4 as uuid } from "uuid";

export async function uploadMemberPhoto(file: File) {
  const extension = file.name.split(".").pop();

  const filename = `${uuid()}.${extension}`;

  const { error } = await supabase.storage
    .from("member-photo")
    .upload(filename, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from("member-photo")
    .getPublicUrl(filename);

  return data.publicUrl;
}