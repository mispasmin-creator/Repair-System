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

export const openDrivePreview = (url) => {
  const previewUrl = getDrivePreviewUrl(url);
  if (previewUrl) {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }
};

export const openFilePreview = openDrivePreview;

