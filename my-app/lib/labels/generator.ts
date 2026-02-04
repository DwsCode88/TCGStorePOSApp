import { jsPDF } from "jspdf";
import { InventoryItem } from "@/types/inventory";

interface FontSize {
  storeName: number;
  cardName: number;
  setInfo: number;
  price: number;
}

interface LabelOptions {
  width?: number;
  height?: number;
  fontSize?: Partial<FontSize>;
  padding?: number;
}

interface ResolvedLabelOptions {
  width: number;
  height: number;
  fontSize: FontSize;
  padding: number;
}

const defaultOptions: ResolvedLabelOptions = {
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

function resolveOptions(options: LabelOptions): ResolvedLabelOptions {
  return {
    width: options.width ?? defaultOptions.width,
    height: options.height ?? defaultOptions.height,
    padding: options.padding ?? defaultOptions.padding,
    fontSize: {
      storeName:
        options.fontSize?.storeName ?? defaultOptions.fontSize.storeName,
      cardName: options.fontSize?.cardName ?? defaultOptions.fontSize.cardName,
      setInfo: options.fontSize?.setInfo ?? defaultOptions.fontSize.setInfo,
      price: options.fontSize?.price ?? defaultOptions.fontSize.price,
    },
  };
}

export function generateLabels(
  items: InventoryItem[],
  options: LabelOptions = {},
): jsPDF {
  const config = resolveOptions(options);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const labelsPerRow = Math.floor(8.5 / config.width);
  const labelsPerColumn = Math.floor(11 / config.height);

  items.forEach((item, index) => {
    const row = Math.floor(index / labelsPerRow) % labelsPerColumn;
    const col = index % labelsPerRow;
    const page = Math.floor(index / (labelsPerRow * labelsPerColumn));

    if (page > 0 && index % (labelsPerRow * labelsPerColumn) === 0) {
      pdf.addPage();
    }

    const x = col * config.width;
    const y = row * config.height;
    let currentY = y + config.padding + 0.15;

    // Store name
    pdf.setFontSize(config.fontSize.storeName);
    pdf.setFont("helvetica", "bold");
    pdf.text("VaultTrove", x + config.padding, currentY);
    currentY += 0.15;

    // Card name - handle undefined
    const cardName = item.cardName || item.name || "Unknown Card";
    pdf.setFontSize(config.fontSize.cardName);
    pdf.text(cardName.substring(0, 25), x + config.padding, currentY);
    currentY += 0.15;

    // Set info - handle undefined
    const setName = item.setName || item.set || "Unknown";
    const printing = item.printing || "Normal";
    pdf.setFontSize(config.fontSize.setInfo);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `${setName} (${printing})`.substring(0, 30),
      x + config.padding,
      currentY,
    );
    currentY += 0.12;

    // Condition and price - handle undefined
    const condition = item.condition || "NM";
    const sellPrice = item.sellPrice ?? 0;
    pdf.setFontSize(config.fontSize.price);
    pdf.setFont("helvetica", "bold");
    pdf.text(
      `${condition}  $${sellPrice.toFixed(2)}`,
      x + config.padding,
      currentY,
    );
    currentY += 0.25;

    // Border (optional)
    pdf.setDrawColor(200);
    pdf.rect(x, y, config.width, config.height);
  });

  return pdf;
}

export function downloadLabels(
  items: InventoryItem[],
  filename = "labels.pdf",
): void {
  const pdf = generateLabels(items);
  pdf.save(filename);
}
