'use client';

import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

type ImageUploadButtonProps = {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
};

export function ImageUploadButton({ onImageSelect, disabled }: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Upload image"
        type="button"
      >
        <Paperclip className="w-5 h-5 text-slate-600" />
      </button>
    </>
  );
}
