import { jsPDF } from "jspdf";
import bwipjs from "bwip-js";
import { InventoryItem } from "@/types/inventory";

export interface LabelDimensions {
  width: number;
  height: number;
}

export interface LabelTemplate {
  width: number;
  height: number;
  fontSize: {
    storeName: number;
    cardName: number;
    setInfo: number;
    price: number;
    sku: number;
  };
  padding: number;
  labelsPerRow: number;
  labelsPerCol: number;
}

// Simple preset dimensions
export const PRESETS: Record<string, LabelDimensions> = {
  standard: { width: 2.0, height: 1.0 },
  large: { width: 2.25, height: 1.25 },
  dymo4x2: { width: 4.0, height: 2.0 },
  dymo4x3: { width: 4.0, height: 3.0 },
};

/**
 * Create template from dimensions
 */
function createTemplate(dimensions: LabelDimensions): LabelTemplate {
  const { width, height } = dimensions;

  // Calculate layout
  const labelsPerRow = Math.floor(8.5 / width);
  const labelsPerCol = Math.floor(11 / height);

  // Scale fonts based on label size
  const scaleFactor = Math.min(width / 2.0, height / 1.0);

  return {
    width,
    height,
    fontSize: {
      storeName: Math.round(8 * scaleFactor),
      cardName: Math.round(10 * scaleFactor),
      setInfo: Math.round(7 * scaleFactor),
      price: Math.round(16 * scaleFactor),
      sku: Math.round(8 * scaleFactor),
    },
    padding: 0.1 * scaleFactor,
    labelsPerRow: Math.max(1, labelsPerRow),
    labelsPerCol: Math.max(1, labelsPerCol),
  };
}

/**
 * Generate label PDF
 * Now just takes dimensions - much simpler!
 */
export async function generateLabelPDF(
  items: InventoryItem[],
  dimensions: LabelDimensions,
): Promise<Blob> {
  // Validate dimensions
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new Error("Invalid dimensions provided");
  }

  if (dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error(
      `Invalid dimensions: ${dimensions.width}x${dimensions.height}`,
    );
  }

  // Create template from dimensions
  const template = createTemplate(dimensions);

  console.log("📄 Generating labels with template:", template);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });
  const { labelsPerRow, labelsPerCol } = template;
  const labelsPerPage = labelsPerRow * labelsPerCol;

  let currentLabel = 0;
  for (const item of items) {
    if (currentLabel > 0 && currentLabel % labelsPerPage === 0) {
      pdf.addPage();
    }
    const labelIndex = currentLabel % labelsPerPage;
    const row = Math.floor(labelIndex / labelsPerRow);
    const col = labelIndex % labelsPerRow;
    const x = col * template.width;
    const y = row * template.height;
    await drawLabel(pdf, item, x, y, template);
    currentLabel++;
  }

  return pdf.output("blob");
}

async function drawLabel(
  pdf: jsPDF,
  item: InventoryItem,
  x: number,
  y: number,
  template: LabelTemplate,
): Promise<void> {
  const { fontSize, padding } = template;
  let currentY = y + padding + 0.1;

  // Store name
  pdf.setFontSize(fontSize.storeName);
  pdf.setFont("helvetica", "bold");
  pdf.text("VaultTrove", x + padding, currentY);
  currentY += 0.15;

  // Card name
  pdf.setFontSize(fontSize.cardName);
  pdf.text(
    (item.cardName || "Unknown Card").substring(0, 25),
    x + padding,
    currentY,
  );
  currentY += 0.15;

  // Set info
  pdf.setFontSize(fontSize.setInfo);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `${item.setName || "Unknown Set"} (${item.printing || "Normal"})`.substring(
      0,
      30,
    ),
    x + padding,
    currentY,
  );
  currentY += 0.12;

  // Price
  pdf.setFontSize(fontSize.price);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    `${item.condition || "NM"}  $${(item.sellPrice || 0).toFixed(2)}`,
    x + padding,
    currentY,
  );
  currentY += 0.25;

  // Barcode
  try {
    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, {
      bcid: "code128",
      text: item.sku,
      scale: 3,
      height: 8,
      includetext: false,
    });
    const img = canvas.toDataURL("image/png");
    pdf.addImage(
      img,
      "PNG",
      x + padding,
      currentY,
      template.width - padding * 2,
      0.25,
    );
    currentY += 0.3;
  } catch (e) {
    console.error("Barcode error:", e);
  }

  // SKU
  pdf.setFontSize(fontSize.sku);
  pdf.setFont("courier", "normal");
  pdf.text(item.sku || "NO-SKU", x + template.width / 2, currentY, {
    align: "center",
  });
}
