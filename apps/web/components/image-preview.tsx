'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPreviewURL, revokePreviewURL } from '@/lib/image-upload';

type ImagePreviewProps = {
  file: File;
  onRemove: () => void;
};

export function ImagePreview({ file, onRemove }: ImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    const url = createPreviewURL(file);
    setPreviewUrl(url);

    return () => {
      revokePreviewURL(url);
    };
  }, [file]);

  return (
    <div className="relative inline-block">
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors"
        type="button"
        title="Remove image"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="mt-1 text-xs text-slate-500 truncate max-w-[80px]">
        {file.name}
      </div>
    </div>
  );
}
