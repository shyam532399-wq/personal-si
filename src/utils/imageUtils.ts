import type { ImageAttachment } from '../types/chat';
import { createId } from './chatUtils';

const MAX_DIMENSION = 1280;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function optimizeImageDataUrl(
  sourceDataUrl: string,
  originalMimeType: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && sourceDataUrl.length < 1_400_000) {
        resolve({ dataUrl: sourceDataUrl, mimeType: originalMimeType });
        return;
      }

      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: sourceDataUrl, mimeType: originalMimeType });
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const outputMime =
        originalMimeType === 'image/png' || originalMimeType === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';
      const compressed = canvas.toDataURL(outputMime, 0.86);
      resolve({ dataUrl: compressed, mimeType: outputMime });
    };
    img.onerror = () => {
      resolve({ dataUrl: sourceDataUrl, mimeType: originalMimeType });
    };
    img.src = sourceDataUrl;
  });
}

export async function processImageFile(file: File): Promise<ImageAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (PNG, JPG, WebP, GIF) are supported.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const { dataUrl, mimeType } = await optimizeImageDataUrl(
    rawDataUrl,
    file.type || 'image/png',
  );

  const commaIdx = dataUrl.indexOf(',');
  const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  return {
    id: createId(),
    name: file.name || 'pasted-image.png',
    mimeType,
    data: base64Data,
    previewUrl: dataUrl,
  };
}
