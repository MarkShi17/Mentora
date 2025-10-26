'use client';

import { useEffect, useCallback } from 'react';

interface ClipboardPasteOptions {
  onImagePaste?: (file: File) => void;
  enabled?: boolean;
}

/**
 * Hook to handle clipboard paste events for images
 * Listens for Ctrl+V / Cmd+V and extracts images from clipboard
 */
export function useClipboardPaste({ onImagePaste, enabled = true }: ClipboardPasteOptions) {
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (!enabled || !onImagePaste) return;

      // Check if clipboard has items
      const items = event.clipboardData?.items;
      if (!items) return;

      // Look for image items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Check if item is an image
        if (item.type.startsWith('image/')) {
          event.preventDefault();

          const file = item.getAsFile();
          if (file) {
            console.log('📋 Image pasted from clipboard:', {
              type: file.type,
              size: file.size,
              name: file.name || 'pasted-image.png'
            });

            onImagePaste(file);
          }
          break; // Only handle first image
        }
      }
    },
    [enabled, onImagePaste]
  );

  useEffect(() => {
    if (!enabled) return;

    // Add paste event listener to document
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, handlePaste]);
}
