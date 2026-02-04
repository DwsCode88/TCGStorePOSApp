import { jsPDF } from "jspdf";
import { InventoryItem } from "@/types/inventory";

interface LabelOptions {
  width?: number;
  height?: number;
  fontSize?: {
    storeName?: number;
    cardName?: number;
    setInfo?: number;
    price?: number;
  };
  padding?: number;
}

const defaultOptions: Required<LabelOptions> = {
  width: 2.5,
  height: 1.0,
  fontSize: {
    storeName: 8,
    cardName: 10,
    setInfo: 7,
    price: 12,
  },
  padding: 0.1,
};

export function generateLabels(
  items: InventoryItem[],
  options: LabelOptions = {},
): jsPDF {
  const { width, height, fontSize, padding } = {
    ...defaultOptions,
    ...options,
    fontSize: { ...defaultOptions.fontSize, ...options.fontSize },
  };

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const labelsPerRow = Math.floor(8.5 / width);
  const labelsPerColumn = Math.floor(11 / height);

  items.forEach((item, index) => {
    const row = Math.floor(index / labelsPerRow) % labelsPerColumn;
    const col = index % labelsPerRow;
    const page = Math.floor(index / (labelsPerRow * labelsPerColumn));

    if (page > 0 && index % (labelsPerRow * labelsPerColumn) === 0) {
      pdf.addPage();
    }

    const x = col * width;
    const y = row * height;
    let currentY = y + padding + 0.15;

    // Store name
    pdf.setFontSize(fontSize.storeName);
    pdf.setFont("helvetica", "bold");
    pdf.text("VaultTrove", x + padding, currentY);
    currentY += 0.15;

    // Card name - handle undefined
    const cardName = item.cardName || item.name || "Unknown Card";
    pdf.setFontSize(fontSize.cardName);
    pdf.text(cardName.substring(0, 25), x + padding, currentY);
    currentY += 0.15;

    // Set info - handle undefined
    const setName = item.setName || item.set || "Unknown";
    const printing = item.printing || "Normal";
    pdf.setFontSize(fontSize.setInfo);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `${setName} (${printing})`.substring(0, 30),
      x + padding,
      currentY,
    );
    currentY += 0.12;

    // Condition and price - handle undefined
    const condition = item.condition || "NM";
    const price = (item.sellPrice || 0).toFixed(2);
    pdf.setFontSize(fontSize.price);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${condition}  $${price}`, x + padding, currentY);
    currentY += 0.25;

    // Border (optional)
    pdf.setDrawColor(200);
    pdf.rect(x, y, width, height);
  });

  return pdf;
}

export function downloadLabels(
  items: InventoryItem[],
  filename = "labels.pdf",
) {
  const pdf = generateLabels(items);
  pdf.save(filename);
}
