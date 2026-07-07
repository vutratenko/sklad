const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function parseQrScanValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    const queryId = url.searchParams.get('id')
      || url.searchParams.get('sku_id')
      || url.searchParams.get('skuId');
    if (queryId) return queryId.trim();

    const parts = url.pathname.split('/').filter(Boolean);
    const skusIdx = parts.findIndex((part) => part === 'skus' || part === 'sku');
    if (skusIdx >= 0 && parts[skusIdx + 1]) return parts[skusIdx + 1].trim();

    const tail = parts[parts.length - 1];
    if (tail && UUID_RE.test(tail)) return tail;
  } catch {
    // not a URL
  }

  if (value.startsWith('{')) {
    try {
      const data = JSON.parse(value);
      const id = data.id || data.sku_id || data.skuId;
      if (id) return String(id).trim();
    } catch {
      // ignore invalid JSON
    }
  }

  const uuidMatch = value.match(UUID_RE);
  if (uuidMatch) return uuidMatch[0];

  return value;
}

export async function startCameraScan(onBarcode, videoEl, options = {}) {
  if (!('BarcodeDetector' in window)) {
    throw new Error('Сканирование камерой не поддерживается в этом браузере');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Камера недоступна');
  }

  const formats = options.formats || ['ean_13', 'ean_8', 'code_128', 'upc_a', 'qr_code'];

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  const detector = new BarcodeDetector({ formats });

  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
  };

  const scan = async () => {
    if (stopped) return;
    try {
      const codes = await detector.detect(videoEl);
      if (codes.length > 0) {
        stop();
        onBarcode(codes[0].rawValue);
        return;
      }
    } catch {
      // ignore frame errors
    }
    requestAnimationFrame(scan);
  };
  scan();

  return stop;
}

export function isCameraScanSupported() {
  return 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}
