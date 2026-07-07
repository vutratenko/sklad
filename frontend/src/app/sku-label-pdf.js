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
        textY: label.margin + row * cellHeight + label.qrSize + 4,
        textWidth: label.qrSize,
      });
    }
  }
  return labels;
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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  labels.forEach((label) => {
    doc.addImage(qrDataURL, 'PNG', label.x, label.y, label.qrSize, label.qrSize);
    const lines = doc.splitTextToSize(name, label.textWidth);
    doc.text(lines.slice(0, 2), label.x + label.qrSize / 2, label.textY, {
      align: 'center',
      maxWidth: label.textWidth,
    });
  });

  doc.save(skuLabelFileName(sku));
  return { code, labels: labels.length };
}
