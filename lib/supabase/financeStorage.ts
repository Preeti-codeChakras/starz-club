import { supabase } from "./client";
import { v4 as uuid } from "uuid";

export async function uploadFinanceReceipt(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new Error("Unable to determine the receipt file type.");
  }

  const fileName = `${uuid()}.${extension}`;

  const { error } = await supabase.storage
    .from("finance-receipts")
    .upload(fileName, file);

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from("finance-receipts")
    .getPublicUrl(fileName);

  return data.publicUrl;
}