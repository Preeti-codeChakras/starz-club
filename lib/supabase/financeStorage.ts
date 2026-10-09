
import { supabase } from "./client";
import { v4 as uuid } from "uuid";

const BUCKET_NAME = "finance-receipts";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Upload a finance receipt to Supabase Storage.
 *
 * Supports JPG, PNG, WebP, and PDF.
 * Maximum file size: 10 MB.
 *
 * Returns the public URL of the uploaded receipt.
 */
export async function uploadFinanceReceipt(
  file: File
): Promise<string> {
  if (!file) {
    throw new Error("Please select a receipt to upload.");
  }

  // Validate file type
  const extension = ALLOWED_FILE_TYPES[file.type];

  if (!extension) {
    throw new Error(
      "Unsupported file type. Please upload a JPG, PNG, WebP, or PDF."
    );
  }

  // Validate file size
  if (file.size === 0) {
    throw new Error("The selected receipt file is empty.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Receipt file must be 10 MB or smaller."
    );
  }

  // Generate a unique filename
  const fileName = `${uuid()}.${extension}`;

  // Upload receipt
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Finance receipt upload failed:", error);

    throw new Error(
      `Unable to upload receipt: ${error.message}`
    );
  }

  if (!data?.path) {
    throw new Error(
      "Receipt upload completed without a valid storage path."
    );
  }

  // Generate public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error(
      "Unable to generate the receipt URL."
    );
  }

  return urlData.publicUrl;
}

/**
 * Return the public URL for an existing receipt.
 *
 * Accepts either a complete URL or a storage path.
 */
export function getFinanceReceiptUrl(
  receiptPathOrUrl: string
): string {
  if (!receiptPathOrUrl) {
    return "";
  }

  if (
    receiptPathOrUrl.startsWith("https://") ||
    receiptPathOrUrl.startsWith("http://")
  ) {
    return receiptPathOrUrl;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(receiptPathOrUrl);

  return data.publicUrl;
}


/**
 * Open an uploaded finance receipt in a new browser tab.
 * Compatible with the existing public Supabase bucket.
 */
export async function viewFinanceReceipt(
  receiptPathOrUrl: string
): Promise<void> {
  if (!receiptPathOrUrl) {
    throw new Error("No receipt is available.");
  }

  const receiptUrl = getFinanceReceiptUrl(
    receiptPathOrUrl
  );

  const newWindow = window.open(
    receiptUrl,
    "_blank",
    "noopener,noreferrer"
  );

  if (!newWindow) {
    throw new Error(
      "Unable to open receipt. Please allow pop-ups."
    );
  }
}
