import { jsPDF } from 'jspdf';
import bwipjs from 'bwip-js';
import { InventoryItem } from '@/types/inventory';

export interface LabelTemplate {
  width: number;
  height: number;
  fontSize: { storeName: number; cardName: number; setInfo: number; price: number; sku: number };
  padding: number;
  labelsPerRow: number;
  labelsPerCol: number;
}

export const LABEL_TEMPLATES: Record<string, LabelTemplate> = {
  standard: { width: 2.0, height: 1.0, fontSize: { storeName: 8, cardName: 10, setInfo: 7, price: 16, sku: 8 }, padding: 0.1, labelsPerRow: 3, labelsPerCol: 10 },
  large: { width: 2.25, height: 1.25, fontSize: { storeName: 8, cardName: 12, setInfo: 8, price: 18, sku: 8 }, padding: 0.12, labelsPerRow: 3, labelsPerCol: 8 },
};

export async function generateLabelPDF(items: InventoryItem[], templateName: keyof typeof LABEL_TEMPLATES = 'standard'): Promise<Blob> {
  const template = LABEL_TEMPLATES[templateName];
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  const { labelsPerRow, labelsPerCol } = template;
  const labelsPerPage = labelsPerRow * labelsPerCol;
  
  let currentLabel = 0;
  for (const item of items) {
    if (currentLabel > 0 && currentLabel % labelsPerPage === 0) pdf.addPage();
    const labelIndex = currentLabel % labelsPerPage;
    const row = Math.floor(labelIndex / labelsPerRow);
    const col = labelIndex % labelsPerRow;
    const x = col * template.width;
    const y = row * template.height;
    await drawLabel(pdf, item, x, y, template);
    currentLabel++;
  }
  return pdf.output('blob');
}

async function drawLabel(pdf: jsPDF, item: InventoryItem, x: number, y: number, template: LabelTemplate): Promise<void> {
  const { fontSize, padding } = template;
  let currentY = y + padding + 0.1;
  
  pdf.setFontSize(fontSize.storeName); pdf.setFont('helvetica', 'bold'); pdf.text('VaultTrove', x + padding, currentY); currentY += 0.15;
  pdf.setFontSize(fontSize.cardName); pdf.text(item.cardName.substring(0, 25), x + padding, currentY); currentY += 0.15;
  pdf.setFontSize(fontSize.setInfo); pdf.setFont('helvetica', 'normal'); pdf.text(`${item.setName} (${item.printing})`.substring(0, 30), x + padding, currentY); currentY += 0.12;
  pdf.setFontSize(fontSize.price); pdf.setFont('helvetica', 'bold'); pdf.text(`${item.condition}  $${item.sellPrice.toFixed(2)}`, x + padding, currentY); currentY += 0.25;
  
  try {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, { bcid: 'code128', text: item.sku, scale: 3, height: 8, includetext: false });
    const img = canvas.toDataURL('image/png');
    pdf.addImage(img, 'PNG', x + padding, currentY, template.width - padding * 2, 0.25);
    currentY += 0.3;
  } catch (e) { console.error('Barcode error:', e); }
  
  pdf.setFontSize(fontSize.sku); pdf.setFont('courier', 'normal'); pdf.text(item.sku, x + template.width / 2, currentY, { align: 'center' });
}
