/**
 * driveUtils.js
 * Utilities for formatting Google Drive links so they open in browser preview
 * instead of triggering forced file downloads.
 */

export const getDrivePreviewUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "link not available") return "";

  // If already a standard drive view URL
  if (trimmed.includes("drive.google.com/file/d/") && trimmed.endsWith("/view")) {
    return trimmed;
  }

  if (!trimmed.includes("drive.google.com")) return trimmed;

  const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    return `https://drive.google.com/file/d/${matchD[1]}/view`;
  }

  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://drive.google.com/file/d/${matchId[1]}/view`;
  }

  return trimmed;
};

export const getDriveDirectImageUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "link not available") return "";

  if (!trimmed.includes("drive.google.com")) return trimmed;

  let fileId = "";
  const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    fileId = matchD[1];
  } else {
    const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      fileId = matchId[1];
    }
  }

  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }

  return trimmed;
};

const EXT_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};
// Types the browser would download (or show as raw text) instead of previewing.
const NON_PREVIEW_TYPES = ["", "application/octet-stream", "binary/octet-stream", "text/plain"];

const mimeFromUrl = (url) => {
  const ext = url.split(/[?#]/)[0].split(".").pop().toLowerCase();
  return EXT_MIME[ext] || "";
};

// Detect the real file type from its first bytes; file names/extensions on
// migrated files are not reliable (e.g. a PDF saved as ".jpg").
const sniffMime = async (blob) => {
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const str = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (str(0, 5) === "%PDF-") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && str(1, 4) === "PNG") return "image/png";
  if (str(0, 3) === "GIF") return "image/gif";
  if (str(0, 4) === "RIFF" && str(8, 12) === "WEBP") return "image/webp";
  return "";
};

// Some stored files (e.g. migrated ones) have a wrong content-type such as
// application/octet-stream, which makes the browser download them. For
// Supabase Storage URLs, re-wrap the bytes with the type from the extension.
const openStorageFile = async (url, tab) => {
  const fallbackMime = mimeFromUrl(url);
  try {
    const head = await fetch(url, { method: "HEAD" });
    const type = (head.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!NON_PREVIEW_TYPES.includes(type)) {
      tab.location.href = url;
      return;
    }
    const res = await fetch(url);
    const blob = await res.blob();
    const mime = (await sniffMime(blob)) || fallbackMime;
    if (!mime) {
      tab.location.href = url;
      return;
    }
    tab.location.href = URL.createObjectURL(new Blob([blob], { type: mime }));
  } catch {
    tab.location.href = url;
  }
};

export const openDrivePreview = (url) => {
  const previewUrl = getDrivePreviewUrl(url);
  if (!previewUrl) return;

  if (previewUrl.includes("/storage/v1/object/public/")) {
    // Open the tab synchronously (popup blockers), then point it at the file.
    const tab = window.open("", "_blank");
    if (tab) {
      openStorageFile(previewUrl, tab);
      return;
    }
  }
  window.open(previewUrl, "_blank", "noopener,noreferrer");
};

export const openFilePreview = openDrivePreview;

