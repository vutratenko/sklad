export async function startCameraScan(onBarcode, videoEl) {
  if (!('BarcodeDetector' in window)) {
    throw new Error('Сканирование камерой не поддерживается в этом браузере');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Камера недоступна');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  const detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'qr_code'],
  });

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
