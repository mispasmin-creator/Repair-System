import React from "react";
import { X, ExternalLink } from "lucide-react";
import { getDrivePreviewUrl, getDriveDirectImageUrl } from "../../utils/driveUtils";

const ImagePreviewModal = ({ isOpen, onClose, imageUrl, title = "Image Preview" }) => {
  if (!isOpen || !imageUrl) return null;

  const directImgUrl = getDriveDirectImageUrl(imageUrl);
  const driveViewUrl = getDrivePreviewUrl(imageUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fadeIn">
      <div className="relative flex flex-col max-w-4xl w-full max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {driveViewUrl && (
              <a
                href={driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                title="Open in Google Drive Viewer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-900/5 min-h-[300px]">
          <img
            src={directImgUrl}
            alt={title}
            className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-sm border border-gray-200 bg-white"
            onError={(e) => {
              // Fallback to drive view in an iframe or open link if direct image fails
              e.currentTarget.onerror = null;
              e.currentTarget.src = imageUrl;
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
