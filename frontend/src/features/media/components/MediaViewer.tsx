import React from 'react';
import { useUIStore } from '../../../shared/store/uiStore';
import { getMediaUrl } from '../../../shared/lib/utils';
import { X, Download } from 'lucide-react';

export const MediaViewer: React.FC = () => {
  const { activeMedia, setActiveMedia } = useUIStore();

  if (!activeMedia) return null;

  const fullUrl = getMediaUrl(activeMedia.url);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-4 select-none animate-message-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between text-white z-10">
        <span className="text-xs font-medium text-white/80">{activeMedia.filename || 'Media Preview'}</span>
        <div className="flex items-center space-x-3">
          <a
            href={fullUrl}
            download={activeMedia.filename || 'media'}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Download"
          >
            <Download size={20} />
          </a>
          <button
            onClick={() => setActiveMedia(null)}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Media Centerpiece */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        {activeMedia.mimeType?.startsWith('image/') || activeMedia.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
          <img
            src={fullUrl}
            alt="Fullscreen preview"
            className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <video
            src={fullUrl}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
          />
        )}
      </div>

      <div className="text-center text-xs text-white/60 pb-2">
        Tap outside or press ESC to close
      </div>
    </div>
  );
};
