import { supabase } from "./supabaseClient";

export const STORAGE_BUCKET = "repair-docs";
export const STORAGE_FOLDER = "files";

/**
 * Uploads a file to Supabase Storage bucket 'repair-docs' inside 'files' folder.
 * Returns the public URL of the uploaded file.
 *
 * @param {File|Blob} file - The file or blob to upload
 * @param {string} [customPrefix] - Optional prefix for filename
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export const uploadFileToSupabase = async (file, customPrefix = "") => {
  if (!file) return "";

  const originalName = file.name || "file.jpg";
  const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const timestamp = Date.now();
  const fileName = customPrefix
    ? `${customPrefix}_${timestamp}_${cleanName}`
    : `${timestamp}_${cleanName}`;
  const filePath = `${STORAGE_FOLDER}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Supabase Storage Upload Error:", error);
    if (
      error.message?.toLowerCase().includes("row-level security") ||
      error.statusCode === "403" ||
      error.code === "AccessDenied"
    ) {
      throw new Error(
        "Supabase Storage RLS Error: repair-docs bucket par public INSERT policy enable karni hogi."
      );
    }
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return publicUrlData?.publicUrl || "";
};
