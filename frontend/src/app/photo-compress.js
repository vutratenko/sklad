const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.85;
const SKIP_BELOW_BYTES = 180_000;

export function scaleDimensions(width, height, maxDimension = DEFAULT_MAX_DIMENSION) {
  const safeMax = Math.max(1, maxDimension);
  if (width <= safeMax && height <= safeMax) {
    return { width, height };
  }
  const ratio = Math.min(safeMax / width, safeMax / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function outputMimeType() {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
    ? 'image/webp'
    : 'image/jpeg';
}

function extensionForMime(mimeType) {
  return mimeType === 'image/webp' ? '.webp' : '.jpg';
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall back to Image element for older browsers.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function closeImageSource(source) {
  source?.close?.();
}

export async function compressPhotoForUpload(file, options = {}) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Нужен файл изображения');
  }

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const mimeType = options.mimeType ?? outputMimeType();

  if (file.size <= SKIP_BELOW_BYTES && (file.type === mimeType || file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }

  const source = await loadImageSource(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const { width, height } = scaleDimensions(sourceWidth, sourceHeight, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    closeImageSource(source);
    throw new Error('Сжатие изображения недоступно в этом браузере');
  }

  ctx.drawImage(source, 0, 0, width, height);
  closeImageSource(source);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Не удалось сжать изображение'))),
      mimeType,
      quality,
    );
  });

  if (blob.size >= file.size && file.type === mimeType) {
    return file;
  }

  const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}${extensionForMime(mimeType)}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}
