import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const A4 = { width: 210, height: 297 };
const LABEL = {
  margin: 10,
  qrSize: 30,
  gapX: 6,
  gapY: 8,
  textHeight: 8,
};

export function primaryBarcode(sku) {
  return String(sku?.barcodes?.[0] || '').trim();
}

export function skuLabelFileName(sku) {
  const code = primaryBarcode(sku) || 'sku';
  return `sklad-${code}.pdf`;
}

export function buildA4QRLabelLayout(page = A4, label = LABEL) {
  const cellWidth = label.qrSize + label.gapX;
  const cellHeight = label.qrSize + label.textHeight + label.gapY;
  const cols = Math.max(1, Math.floor((page.width - label.margin * 2 + label.gapX) / cellWidth));
  const rows = Math.max(1, Math.floor((page.height - label.margin * 2 + label.gapY) / cellHeight));
  const labels = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      labels.push({
        x: label.margin + col * cellWidth,
        y: label.margin + row * cellHeight,
        qrSize: label.qrSize,
        textY: label.margin + row * cellHeight + label.qrSize + 2,
        textWidth: label.qrSize,
        textHeight: label.textHeight,
      });
    }
  }
  return labels;
}

export function createTextImageDataURL(text, options = {}) {
  const width = options.width || 256;
  const height = options.height || 72;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111317';
  ctx.font = `${options.fontWeight || 600} ${options.fontSize || 20}px ${options.fontFamily || 'Inter, Arial, sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= width - 8 || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  const visible = lines.slice(0, 2);
  const lineHeight = options.lineHeight || 24;
  const startY = height / 2 - ((visible.length - 1) * lineHeight) / 2;
  visible.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight, width - 8);
  });

  return canvas.toDataURL('image/png');
}

export async function generateSKUQRCodePDF(sku, options = {}) {
  const code = primaryBarcode(sku);
  if (!code) {
    throw new Error('У SKU нет штрихкода');
  }

  const doc = options.doc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const qrDataURL = await (options.qrFactory || QRCode.toDataURL)(code, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  const labels = buildA4QRLabelLayout(options.page, options.label);
  const name = String(sku.name || code);
  const textImageFactory = options.textImageFactory || createTextImageDataURL;

  labels.forEach((label) => {
    doc.addImage(qrDataURL, 'PNG', label.x, label.y, label.qrSize, label.qrSize);
    const textDataURL = textImageFactory(name, {
      width: 256,
      height: 72,
    });
    doc.addImage(textDataURL, 'PNG', label.x, label.textY, label.textWidth, label.textHeight);
  });

  doc.save(skuLabelFileName(sku));
  return { code, labels: labels.length };
}
