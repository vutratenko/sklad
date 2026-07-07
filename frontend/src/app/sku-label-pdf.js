import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const A4 = { width: 210, height: 297 };
const LABEL = {
  margin: 10,
  qrSize: 20,
  gapX: 4,
  gapY: 4,
  textHeight: 6,
};

export const QR_LABEL_THEME = {
  module: '#ffffff',
  background: '#000000',
  text: '#111317',
};

export function primaryBarcode(sku) {
  return String(sku?.barcodes?.[0] || '').trim();
}

export function isFinderRegion(row, col, size) {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= size - 7) return true;
  if (row >= size - 7 && col < 7) return true;
  return false;
}

export function shouldRenderSolidModule(row, col, size, modules) {
  if (isFinderRegion(row, col, size)) return true;
  if (!modules.get(row, col)) return false;

  const alignmentCenters = [];
  if (size >= 25) {
    alignmentCenters.push([6, size - 7], [size - 7, 6], [size - 7, size - 7]);
  } else if (size >= 21) {
    alignmentCenters.push([size - 7, size - 7]);
  }

  for (const [centerRow, centerCol] of alignmentCenters) {
    if (Math.abs(row - centerRow) <= 2 && Math.abs(col - centerCol) <= 2) {
      return true;
    }
  }

  return row === 6 || col === 6;
}

export function skuLabelFileName(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return 'sklad-qr-labels.pdf';
  }
  if (entries.length === 1) {
    const code = primaryBarcode(entries[0].sku) || 'sku';
    return `sklad-${code}.pdf`;
  }
  return 'sklad-qr-labels.pdf';
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
        textY: label.margin + row * cellHeight + label.qrSize + 1,
        textWidth: label.qrSize,
        textHeight: label.textHeight,
      });
    }
  }
  return labels;
}

export function flattenLabelEntries(entries) {
  const flat = [];
  for (const entry of entries || []) {
    const count = Math.max(0, Number(entry.count) || 0);
    if (count === 0) continue;
    const code = primaryBarcode(entry.sku);
    if (!code) {
      throw new Error(`У SKU «${entry.sku?.name || 'без названия'}» нет штрихкода`);
    }
    for (let i = 0; i < count; i += 1) {
      flat.push({ sku: entry.sku, code });
    }
  }
  if (flat.length === 0) {
    throw new Error('Выберите хотя бы один QR код');
  }
  return flat;
}

export function createStyledQrDataURL(code, options = {}) {
  const theme = { ...QR_LABEL_THEME, ...options.theme };
  const size = options.width || 384;
  const marginModules = 4;
  const qr = QRCode.create(String(code), { errorCorrectionLevel: 'Q' });
  const modules = qr.modules;
  const count = modules.size;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not available');
  }

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, size, size);

  const cellSize = size / (count + marginModules * 2);
  ctx.fillStyle = theme.module;

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!modules.get(row, col)) continue;
      const x = (col + marginModules + 0.5) * cellSize;
      const y = (row + marginModules + 0.5) * cellSize;
      if (shouldRenderSolidModule(row, col, count, modules)) {
        const edge = cellSize - 0.75;
        ctx.fillRect(x - edge / 2, y - edge / 2, edge, edge);
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, cellSize * 0.47, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas.toDataURL('image/png');
}

export function createTextImageDataURL(text, options = {}) {
  const theme = { ...QR_LABEL_THEME, ...options.theme };
  const width = options.width || 256;
  const height = options.height || 72;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.text;
  ctx.font = `${options.fontWeight || 600} ${options.fontSize || 16}px ${options.fontFamily || 'Inter, Arial, sans-serif'}`;
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
  const lineHeight = options.lineHeight || 18;
  const startY = height / 2 - ((visible.length - 1) * lineHeight) / 2;
  visible.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight, width - 8);
  });

  return canvas.toDataURL('image/png');
}

async function qrDataURLForCode(code, qrFactory, theme) {
  if (qrFactory) {
    return qrFactory(code);
  }
  return createStyledQrDataURL(code, { theme, width: 384 });
}

export async function generateBatchSKUQRCodePDF(entries, options = {}) {
  const flat = flattenLabelEntries(entries);
  const doc = options.doc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const labels = buildA4QRLabelLayout(options.page, options.label);
  const textImageFactory = options.textImageFactory || createTextImageDataURL;
  const theme = { ...QR_LABEL_THEME, ...options.theme };
  const qrCache = new Map();

  for (let index = 0; index < flat.length; index += 1) {
    const pageIndex = index % labels.length;
    if (index > 0 && pageIndex === 0) {
      doc.addPage();
    }
    const item = flat[index];
    const pos = labels[pageIndex];
    if (!qrCache.has(item.code)) {
      qrCache.set(item.code, await qrDataURLForCode(item.code, options.qrFactory, theme));
    }
    const qrDataURL = qrCache.get(item.code);
    const name = String(item.sku?.name || item.code);

    doc.addImage(qrDataURL, 'PNG', pos.x, pos.y, pos.qrSize, pos.qrSize);
    const textDataURL = textImageFactory(name, {
      width: 256,
      height: 48,
      fontSize: 14,
      lineHeight: 16,
      theme,
    });
    doc.addImage(textDataURL, 'PNG', pos.x, pos.textY, pos.textWidth, pos.textHeight);
  }

  doc.save(skuLabelFileName(entries));
  return { labels: flat.length, pages: Math.ceil(flat.length / labels.length) };
}

export async function generateSKUQRCodePDF(sku, options = {}) {
  return generateBatchSKUQRCodePDF([{ sku, count: labelsPerPage(options) }], options);
}

function labelsPerPage(options = {}) {
  return buildA4QRLabelLayout(options.page, options.label).length;
}
