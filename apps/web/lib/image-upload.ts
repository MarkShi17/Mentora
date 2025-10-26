/**
 * Image upload utilities for handling image files
 * Supports validation, conversion, and compression
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for videos
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageData {
  base64: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export interface VideoData {
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload PNG, JPG, GIF, or WebP images.`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds ${sizeMB}MB limit.`
    };
  }

  return { valid: true };
}

/**
 * Validate video file
 */
export function validateVideoFile(file: File): ImageValidationResult {
  // Check file type
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload MP4, WebM, OGG, or QuickTime videos.`
    };
  }

  // Check file size
  if (file.size > MAX_VIDEO_SIZE) {
    const sizeMB = (MAX_VIDEO_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds ${sizeMB}MB limit.`
    };
  }

  return { valid: true };
}

/**
 * Convert File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Process image file for upload
 * Returns base64 data and metadata
 */
export async function processImageFile(file: File): Promise<ImageData> {
  // Validate
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Convert to base64
  const base64 = await fileToBase64(file);

  // Get dimensions
  let dimensions: { width: number; height: number } | undefined;
  try {
    dimensions = await getImageDimensions(file);
  } catch (error) {
    console.warn('Could not get image dimensions:', error);
  }

  return {
    base64,
    mimeType: file.type,
    size: file.size,
    ...(dimensions && { width: dimensions.width, height: dimensions.height })
  };
}

/**
 * Upload image to server
 */
export async function uploadImageToServer(base64: string, mimeType: string): Promise<string> {
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ base64, mimeType })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }

  const { url } = await response.json();
  return url;
}

/**
 * Create preview URL from File
 */
export function createPreviewURL(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke preview URL to free memory
 */
export function revokePreviewURL(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Get video dimensions from file
 */
export function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };

    video.src = url;
  });
}

/**
 * Process video file for upload
 * Returns object URL and metadata
 */
export async function processVideoFile(file: File): Promise<VideoData> {
  // Validate
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create object URL for video
  const url = URL.createObjectURL(file);

  // Get dimensions
  let dimensions: { width: number; height: number } | undefined;
  try {
    dimensions = await getVideoDimensions(file);
  } catch (error) {
    console.warn('Could not get video dimensions:', error);
  }

  return {
    url,
    mimeType: file.type,
    size: file.size,
    ...(dimensions && { width: dimensions.width, height: dimensions.height })
  };
}
