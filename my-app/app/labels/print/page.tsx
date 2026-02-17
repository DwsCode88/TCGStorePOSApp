"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import { Printer, CheckSquare, Square } from "lucide-react";
import { jsPDF } from "jspdf";
import bwipjs from "bwip-js";

export const dynamic = "force-dynamic";

export default function LabelsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]); // Store all items
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Batch filtering
  const [selectedBatch, setSelectedBatch] = useState<string>("priced-only");
  const [batches, setBatches] = useState<string[]>([]);

  // Label size
  const [width, setWidth] = useState(2.0);
  const [height, setHeight] = useState(1.0);
  const [spacing, setSpacing] = useState(0.1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [onePerPage, setOnePerPage] = useState(true);

  // Simple Y positions (percentage from top)
  const [storeY, setStoreY] = useState(8);
  const [cardY, setCardY] = useState(22);
  const [setY, setSetY] = useState(35);
  const [priceY, setPriceY] = useState(50);
  const [barcodeY, setBarcodeY] = useState(70);
  const [skuY, setSkuY] = useState(94);

  // Font sizes
  const [storeFontSize, setStoreFontSize] = useState(7);
  const [cardFontSize, setCardFontSize] = useState(9);
  const [setFontSize, setSetFontSize] = useState(6);
  const [priceFontSize, setPriceFontSize] = useState(14);
  const [skuFontSize, setSkuFontSize] = useState(7);

  // Show/hide
  const [showStore, setShowStore] = useState(true);
  const [showSet, setShowSet] = useState(true);

  // Label options
  const [useQRCode, setUseQRCode] = useState(false); // QR code instead of barcode
  const [verticalOrientation, setVerticalOrientation] = useState(false); // Rotate 90 degrees

  useEffect(() => {
    loadInventory();
    loadSavedLayout();
  }, []);

  const loadSavedLayout = () => {
    const saved = localStorage.getItem("labelLayout");
    if (saved) {
      try {
        const layout = JSON.parse(saved);
        setStoreY(layout.storeY ?? 8);
        setCardY(layout.cardY ?? 22);
        setSetY(layout.setY ?? 35);
        setPriceY(layout.priceY ?? 50);
        setBarcodeY(layout.barcodeY ?? 70);
        setSkuY(layout.skuY ?? 94);
        setStoreFontSize(layout.storeFontSize ?? 7);
        setCardFontSize(layout.cardFontSize ?? 9);
        setSetFontSize(layout.setFontSize ?? 6);
        setPriceFontSize(layout.priceFontSize ?? 14);
        setSkuFontSize(layout.skuFontSize ?? 7);
        setShowStore(layout.showStore ?? true);
        setShowSet(layout.showSet ?? true);
        setWidth(layout.width ?? 2.0);
        setHeight(layout.height ?? 1.0);
        setSpacing(layout.spacing ?? 0.1);
        setOffsetX(layout.offsetX ?? 0);
        setOffsetY(layout.offsetY ?? 0);
        setOnePerPage(layout.onePerPage ?? true);
        setUseQRCode(layout.useQRCode ?? false);
        setVerticalOrientation(layout.verticalOrientation ?? false);
        console.log("✅ Loaded saved layout");
      } catch (e) {
        console.error("Failed to load layout:", e);
      }
    }
  };

  const saveLayout = () => {
    const layout = {
      storeY,
      cardY,
      setY,
      priceY,
      barcodeY,
      skuY,
      storeFontSize,
      cardFontSize,
      setFontSize,
      priceFontSize,
      skuFontSize,
      showStore,
      showSet,
      width,
      height,
      spacing,
      offsetX,
      offsetY,
      onePerPage,
      useQRCode,
      verticalOrientation,
    };
    localStorage.setItem("labelLayout", JSON.stringify(layout));
    toast.success("Layout saved! It will load automatically next time.");
    console.log("💾 Saved layout:", layout);
  };

  const resetLayout = () => {
    if (confirm("Reset to default layout?")) {
      setStoreY(8);
      setCardY(22);
      setSetY(35);
      setPriceY(50);
      setBarcodeY(70);
      setSkuY(94);
      setStoreFontSize(7);
      setCardFontSize(9);
      setSetFontSize(6);
      setPriceFontSize(14);
      setSkuFontSize(7);
      setShowStore(true);
      setShowSet(true);
      setWidth(2.0);
      setHeight(1.0);
      setSpacing(0.1);
      setOffsetX(0);
      setOffsetY(0);
      setOnePerPage(true);
      toast.success("Layout reset to defaults");
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      console.log("📦 Loading inventory from Firebase...");
      const snapshot = await getDocs(collection(db, "inventory"));

      // ✅ FIXED: Use SKU from database, not doc ID
      const loadedItems = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id, // Keep doc ID for updates
          sku: data.sku || doc.id, // ✅ Use SKU from database, fallback to doc ID
        };
      }) as InventoryItem[];

      console.log(`\n📊 INVENTORY STATUS BREAKDOWN:`);
      console.log(`Total items in database: ${loadedItems.length}`);

      const statusCount: Record<string, number> = {};
      loadedItems.forEach((item) => {
        const status = item.status || "unknown";
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} items`);
      });

      // Extract unique batch IDs
      const uniqueBatches = Array.from(
        new Set(loadedItems.map((item) => item.batchId).filter((id) => id)),
      ).sort((a, b) => b.localeCompare(a)); // Most recent first

      setBatches(uniqueBatches);
      setAllItems(loadedItems);

      // Apply initial filter (priced-only by default)
      filterItemsByBatch(loadedItems, selectedBatch);

      console.log(`\n📦 Found ${uniqueBatches.length} unique batches`);
      console.log("");

      toast.success(`Loaded ${loadedItems.length} items from inventory`);
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const filterItemsByBatch = (
    itemsToFilter: InventoryItem[],
    batchFilter: string,
  ) => {
    let filtered: InventoryItem[];

    if (batchFilter === "priced-only") {
      // Show only items that need labels (status: priced)
      filtered = itemsToFilter.filter((item) => item.status === "priced");
      console.log(
        `🏷️ Filtered to ${filtered.length} items that need labels (priced)`,
      );
    } else if (batchFilter === "all") {
      // Show all items
      filtered = itemsToFilter;
      console.log(`📦 Showing all ${filtered.length} items`);
    } else {
      // Filter by specific batch
      filtered = itemsToFilter.filter((item) => item.batchId === batchFilter);
      console.log(
        `📦 Filtered to batch ${batchFilter}: ${filtered.length} items`,
      );
    }

    setItems(
      filtered.sort((a, b) => {
        if (a.status === "priced" && b.status !== "priced") return -1;
        if (a.status !== "priced" && b.status === "priced") return 1;
        return 0;
      }),
    );
  };

  // Handle batch filter change
  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId);
    setSelectedItems(new Set()); // Clear selection when changing batch
    filterItemsByBatch(allItems, batchId);
  };

  const toggleItem = (sku: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.sku)));
    }
  };

  const handleGenerate = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    const itemsToLabel = items.filter((item) => selectedItems.has(item.sku));

    const totalLabels = itemsToLabel.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0,
    );

    const cardList = itemsToLabel
      .map((item, i) => {
        const qty = item.quantity || 1;
        return `${i + 1}. ${item.cardName} ${qty > 1 ? `(×${qty})` : ""} (${item.sku})`;
      })
      .join("\n");

    const confirmed = confirm(
      `Generate ${totalLabels} label${totalLabels !== 1 ? "s" : ""}?\n\n` +
        `Items: ${itemsToLabel.length}\n` +
        `Total labels (with quantity): ${totalLabels}\n` +
        `Mode: ${onePerPage ? "One label per page" : "Multiple per page"}\n\n` +
        `Cards:\n${cardList}\n\n` +
        `Click OK to generate PDF.`,
    );

    if (!confirmed) {
      console.log("❌ User cancelled generation");
      return;
    }

    setGenerating(true);

    console.log("==========================================");
    console.log("🏷️ GENERATING LABELS");
    console.log("==========================================");
    console.log(`Items selected: ${selectedItems.size}`);
    console.log("");

    if (itemsToLabel.length === 0) {
      toast.error("No items matched selection!");
      setGenerating(false);
      return;
    }

    const expandedItems: InventoryItem[] = [];
    itemsToLabel.forEach((item) => {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        expandedItems.push(item);
      }
    });

    console.log(`📝 Expanded to ${expandedItems.length} total labels\n`);

    try {
      toast.loading(`Generating ${expandedItems.length} labels...`);

      const labelWidthWithMargin = width + spacing;
      const labelHeightWithMargin = height + spacing;

      // Swap dimensions for vertical orientation
      const effectiveWidth = verticalOrientation ? height : width;
      const effectiveHeight = verticalOrientation ? width : height;
      const effectiveWidthWithMargin = verticalOrientation
        ? labelHeightWithMargin
        : labelWidthWithMargin;
      const effectiveHeightWithMargin = verticalOrientation
        ? labelWidthWithMargin
        : labelHeightWithMargin;

      let labelsPerRow, labelsPerCol, labelsPerPage;

      if (onePerPage) {
        labelsPerRow = 1;
        labelsPerCol = 1;
        labelsPerPage = 1;
        console.log(
          `📄 ONE LABEL PER PAGE mode${verticalOrientation ? " (VERTICAL)" : ""}`,
        );
      } else {
        labelsPerRow = Math.floor(8.5 / effectiveWidthWithMargin);
        labelsPerCol = Math.floor(11 / effectiveHeightWithMargin);
        labelsPerPage = labelsPerRow * labelsPerCol;
        console.log(
          `📄 ${labelsPerRow}×${labelsPerCol} = ${labelsPerPage} labels per page`,
        );
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: "letter",
      });

      let pagesCreated = 0;

      for (let i = 0; i < expandedItems.length; i++) {
        if (i > 0) {
          if (onePerPage) {
            pdf.addPage();
            pagesCreated++;
          } else if (i % labelsPerPage === 0) {
            pdf.addPage();
            pagesCreated++;
          }
        } else {
          pagesCreated = 1;
        }

        const item = expandedItems[i];

        let labelX, labelY;

        if (onePerPage) {
          labelX = offsetX;
          labelY = offsetY;
        } else {
          const labelIndex = i % labelsPerPage;
          const row = Math.floor(labelIndex / labelsPerRow);
          const col = labelIndex % labelsPerRow;
          labelX = col * labelWidthWithMargin + offsetX;
          labelY = row * labelHeightWithMargin + offsetY;
        }

        const leftMargin = 0.1;

        // For vertical orientation, we'll use width/height as-is but rotate the final rendering
        const renderWidth = verticalOrientation ? height : width;
        const renderHeight = verticalOrientation ? width : height;

        // TOP: Price and Condition on SAME LINE
        const priceYPos = labelY + (priceY / 100) * renderHeight;
        pdf.setFontSize(priceFontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          `$${(item.sellPrice || 0).toFixed(2)}  ${item.condition || "NM"}`,
          labelX + renderWidth / 2,
          priceYPos,
          { align: "center" },
        );

        // MIDDLE: QR Code or Barcode (Centered, larger)
        const barcodeYPos = labelY + (barcodeY / 100) * renderHeight;
        try {
          const canvas = document.createElement("canvas");
          bwipjs.toCanvas(canvas, {
            bcid: useQRCode ? "qrcode" : "code128",
            text: item.sku,
            scale: useQRCode ? 3 : 3,
            height: useQRCode ? 10 : 8,
            includetext: false,
          });
          const img = canvas.toDataURL("image/png");

          const codeWidth = useQRCode
            ? renderHeight * 0.35
            : renderWidth * 0.85;
          const codeHeight = useQRCode
            ? renderHeight * 0.35
            : renderHeight * 0.12;
          const codeX = labelX + (renderWidth - codeWidth) / 2;

          pdf.addImage(
            img,
            "PNG",
            codeX,
            barcodeYPos - (useQRCode ? codeHeight / 2 : 0),
            codeWidth,
            codeHeight,
          );
        } catch (e) {
          console.error(useQRCode ? "QR code error:" : "Barcode error:", e);
        }

        // BOTTOM: Card Name
        const cardYPos = labelY + (cardY / 100) * renderHeight;
        pdf.setFontSize(cardFontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          (item.cardName || "Unknown").substring(0, 30),
          labelX + renderWidth / 2,
          cardYPos,
          { align: "center" },
        );

        // Set Name (if shown)
        if (showSet) {
          const setYPos = labelY + (setY / 100) * renderHeight;
          pdf.setFontSize(setFontSize);
          pdf.setFont("helvetica", "normal");
          const setInfo = item.setName || "Unknown Set";
          const printing =
            item.printing && item.printing !== "Normal"
              ? ` (${item.printing})`
              : "";
          pdf.text(
            `${setInfo}${printing}`.substring(0, 35),
            labelX + renderWidth / 2,
            setYPos,
            { align: "center" },
          );
        }

        // Store name (if shown)
        if (showStore) {
          const y = labelY + (storeY / 100) * renderHeight;
          pdf.setFontSize(storeFontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text("VaultTrove", labelX + renderWidth / 2, y, {
            align: "center",
          });
        }

        // SKU - ✅ Using item.sku which now contains correct SKU from database
        const skuYPos = labelY + (skuY / 100) * renderHeight;
        pdf.setFontSize(skuFontSize);
        pdf.setFont("courier", "normal");
        pdf.text(item.sku, labelX + renderWidth / 2, skuYPos, {
          align: "center",
        }); // ✅ Correct SKU
      }

      const pdfBlob = pdf.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `labels-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // ✅ FIXED: Use item.id (document ID) for updateDoc, not item.sku
      await Promise.all(
        itemsToLabel.map((item) =>
          updateDoc(doc(db, "inventory", item.id || item.sku), {
            // ✅ Use doc ID
            status: "labeled",
            updatedAt: new Date(),
          }),
        ),
      );

      console.log("✅ Labels generated and items marked as labeled");
      toast.success(
        `Generated ${expandedItems.length} labels! Items removed from queue.`,
      );

      await loadInventory();
      setSelectedItems(new Set());
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const allSelected = items.length > 0 && selectedItems.size === items.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Print Labels</h1>
        <p className="text-gray-600 mb-4">
          {selectedBatch === "priced-only"
            ? "Showing only items that need labels (status: priced)"
            : selectedBatch === "all"
              ? "Showing all items"
              : `Showing items from batch: ${selectedBatch}`}
        </p>

        {/* Batch Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filter by Batch:
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="priced-only">📋 Needs Labels (Priced Only)</option>
              <option value="all">📦 All Items</option>
              {batches.length > 0 && (
                <optgroup label="── Batches ──">
                  {batches.map((batchId) => (
                    <option key={batchId} value={batchId}>
                      {batchId}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {items.length} items
            </div>
          </div>
        </div>

        {items.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center mb-6">
            <div className="text-6xl mb-4">
              {selectedBatch === "priced-only" ? "✅" : "📦"}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedBatch === "priced-only"
                ? "All caught up!"
                : "No items found"}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedBatch === "priced-only"
                ? "No items need labels. All priced items have already been labeled."
                : selectedBatch === "all"
                  ? "No items in inventory."
                  : `No items found in batch: ${selectedBatch}`}
            </p>
            <p className="text-sm text-gray-500">
              {selectedBatch === "priced-only"
                ? "Add new items or check the inventory page to see labeled items."
                : "Try selecting a different batch from the filter above."}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* Label Preview */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  📋 Label Designer & Preview
                </h2>
                <div className="text-sm text-gray-600">
                  Adjust settings below to update preview in real-time
                </div>
              </div>

              <div className="flex justify-center items-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-8 mb-4">
                <div
                  className="bg-white border-4 border-gray-800 shadow-2xl relative overflow-hidden"
                  style={{
                    width: verticalOrientation
                      ? `${height * 96}px`
                      : `${width * 96}px`,
                    height: verticalOrientation
                      ? `${width * 96}px`
                      : `${height * 96}px`,
                    transform: verticalOrientation ? "rotate(90deg)" : "none",
                    transformOrigin: "center",
                  }}
                >
                  {/* Position Guide Lines (only show in preview) */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                    {[0, 25, 50, 75, 100].map((percent) => (
                      <div
                        key={percent}
                        className="absolute w-full border-t border-blue-300 border-dashed"
                        style={{ top: `${percent}%` }}
                      >
                        <span className="absolute right-1 text-[8px] text-blue-600 -mt-2">
                          {percent}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* TOP: Price (Large, centered) */}
                  <div
                    className="absolute w-full text-center font-black"
                    style={{
                      top: `${priceY}%`,
                      fontSize: `${priceFontSize}px`,
                      transform: "translateY(-50%)",
                      lineHeight: 1,
                    }}
                  >
                    $10.00
                  </div>

                  {/* Condition below price */}
                  <div
                    className="absolute w-full text-center font-bold"
                    style={{
                      top: `${priceY + 12}%`,
                      fontSize: `${priceFontSize - 2}px`,
                      transform: "translateY(-50%)",
                      lineHeight: 1,
                    }}
                  >
                    NM
                  </div>

                  {/* MIDDLE: Barcode or QR Code (Centered, larger) */}
                  <div
                    className="absolute left-1/2 flex flex-col items-center"
                    style={{
                      top: `${barcodeY}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {useQRCode ? (
                      /* QR Code Placeholder - BIGGER */
                      <div
                        className="border-2 border-black"
                        style={{
                          width: `${height * 28}px`,
                          height: `${height * 28}px`,
                          display: "grid",
                          gridTemplateColumns: "repeat(7, 1fr)",
                          gridTemplateRows: "repeat(7, 1fr)",
                          gap: "1px",
                          backgroundColor: "black",
                        }}
                      >
                        {Array.from({ length: 49 }).map((_, i) => (
                          <div
                            key={i}
                            className={
                              Math.random() > 0.5 ? "bg-black" : "bg-white"
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      /* Barcode Placeholder */
                      <div className="flex gap-px">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div
                            key={i}
                            className="bg-black"
                            style={{
                              width: i % 5 === 0 ? "3px" : "2px",
                              height: `${height * 16}px`,
                              opacity: Math.random() > 0.2 ? 1 : 0,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BOTTOM: Card Name (centered) */}
                  <div
                    className="absolute w-full text-center font-bold"
                    style={{
                      top: `${cardY}%`,
                      fontSize: `${cardFontSize}px`,
                      transform: "translateY(-50%)",
                      paddingLeft: "4px",
                      paddingRight: "4px",
                      lineHeight: 1.1,
                    }}
                  >
                    Monkey.D.Luffy
                  </div>

                  {/* Set Name (centered) */}
                  {showSet && (
                    <div
                      className="absolute w-full text-center text-gray-600"
                      style={{
                        top: `${setY}%`,
                        fontSize: `${setFontSize}px`,
                        transform: "translateY(-50%)",
                        lineHeight: 1.1,
                      }}
                    >
                      Romance Dawn
                    </div>
                  )}

                  {/* Store Name (centered, top) */}
                  {showStore && (
                    <div
                      className="absolute w-full text-center font-bold"
                      style={{
                        top: `${storeY}%`,
                        fontSize: `${storeFontSize}px`,
                        transform: "translateY(-50%)",
                        lineHeight: 1.1,
                      }}
                    >
                      Your Store Name
                    </div>
                  )}

                  {/* SKU */}
                  <div
                    className="absolute w-full text-center font-mono"
                    style={{
                      top: `${skuY}%`,
                      fontSize: `${skuFontSize}px`,
                      transform: "translateY(-50%)",
                      lineHeight: 1.1,
                    }}
                  >
                    OP01-001-NM
                  </div>

                  {/* Dimension Label */}
                  <div className="absolute -bottom-8 left-0 right-0 text-center text-sm font-semibold text-gray-700">
                    {width}" × {height}"
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <div className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <span>📏</span> Label Size
                  </div>
                  <div className="text-blue-800 font-mono text-lg">
                    {width}" × {height}"
                  </div>
                  <div className="text-blue-600 text-xs mt-1">
                    {(width * 2.54).toFixed(1)}cm × {(height * 2.54).toFixed(1)}
                    cm
                  </div>
                </div>
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <div className="font-bold text-green-900 mb-2 flex items-center gap-2">
                    <span>✅</span> Elements Shown
                  </div>
                  <div className="text-green-800">
                    {[
                      showStore && "Store",
                      "Card Name",
                      showSet && "Set",
                      "Price",
                      "Barcode",
                      "SKU",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                  <div className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <span>🎨</span> Font Sizes
                  </div>
                  <div className="text-purple-800 text-xs space-y-1">
                    {showStore && <div>Store: {storeFontSize}pt</div>}
                    <div>Card: {cardFontSize}pt</div>
                    {showSet && <div>Set: {setFontSize}pt</div>}
                    <div>Price: {priceFontSize}pt</div>
                    <div>SKU: {skuFontSize}pt</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-xl">💡</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-900 mb-1">
                      Quick Tips:
                    </div>
                    <ul className="text-sm text-amber-800 space-y-1">
                      <li>
                        • <strong>Y Position (%)</strong> = Vertical position
                        from top (0% = top, 100% = bottom)
                      </li>
                      <li>
                        • <strong>Font Size (pt)</strong> = Text size in points
                        (larger = bigger text)
                      </li>
                      <li>
                        • Click <strong>💾 Save Layout</strong> to remember your
                        settings
                      </li>
                      <li>
                        • Guide lines show 0%, 25%, 50%, 75%, 100% positions
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Label Layout</h2>
                  <div className="flex gap-2">
                    <Button onClick={saveLayout} variant="outline" size="sm">
                      💾 Save Layout
                    </Button>
                    <Button onClick={resetLayout} variant="outline" size="sm">
                      🔄 Reset
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm">
                  {selectedBatch === "priced-only" ? (
                    <>
                      <strong>ℹ️ Only showing items that need labels</strong> -
                      Already labeled and listed items are automatically hidden.
                    </>
                  ) : selectedBatch === "all" ? (
                    <>
                      <strong>ℹ️ Showing all items</strong> - Including already
                      labeled items. Use this to reprint labels for any item.
                    </>
                  ) : (
                    <>
                      <strong>ℹ️ Batch Filter Active</strong> - Showing items
                      from batch:{" "}
                      <code className="bg-blue-100 px-1 py-0.5 rounded">
                        {selectedBatch}
                      </code>
                      . You can reprint labels for these items.
                    </>
                  )}
                </div>

                {selectedItems.size > 0 && (
                  <div className="bg-green-50 border-2 border-green-400 rounded p-4 mb-4">
                    <div className="font-bold text-green-900 mb-2 text-lg">
                      ✅ {selectedItems.size} item
                      {selectedItems.size !== 1 ? "s" : ""} selected
                    </div>
                    <div className="text-sm text-green-800 space-y-1 max-h-48 overflow-y-auto">
                      {items
                        .filter((item) => selectedItems.has(item.sku))
                        .map((item, i) => {
                          const qty = item.quantity || 1;
                          return (
                            <div
                              key={item.sku}
                              className="flex items-center gap-2"
                            >
                              <span className="font-mono text-xs bg-green-200 px-2 py-1 rounded">
                                {i + 1}
                              </span>
                              <span className="font-semibold">
                                {item.cardName}
                              </span>
                              {qty > 1 && (
                                <span className="text-xs font-bold bg-green-300 px-2 py-0.5 rounded">
                                  ×{qty}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    {(() => {
                      const totalLabels = items
                        .filter((it) => selectedItems.has(it.sku))
                        .reduce((sum, it) => sum + (it.quantity || 1), 0);
                      return (
                        <div className="mt-3 pt-3 border-t border-green-300">
                          <div className="text-sm text-green-900 font-bold">
                            📊 Total labels: {totalLabels}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 border rounded">
                    <input
                      type="checkbox"
                      checked={showStore}
                      onChange={(e) => setShowStore(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Store Name Y (%)
                        </label>
                        <input
                          type="number"
                          value={storeY}
                          onChange={(e) =>
                            setStoreY(parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          value={storeFontSize}
                          onChange={(e) =>
                            setStoreFontSize(parseInt(e.target.value) || 7)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 border rounded">
                    <div className="w-5"></div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Card Name Y (%)
                        </label>
                        <input
                          type="number"
                          value={cardY}
                          onChange={(e) =>
                            setCardY(parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          value={cardFontSize}
                          onChange={(e) =>
                            setCardFontSize(parseInt(e.target.value) || 9)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 border rounded">
                    <input
                      type="checkbox"
                      checked={showSet}
                      onChange={(e) => setShowSet(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Set Name Y (%)
                        </label>
                        <input
                          type="number"
                          value={setY}
                          onChange={(e) =>
                            setSetY(parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          value={setFontSize}
                          onChange={(e) =>
                            setSetFontSize(parseInt(e.target.value) || 6)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 border rounded">
                    <div className="w-5"></div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Price Y (%)
                        </label>
                        <input
                          type="number"
                          value={priceY}
                          onChange={(e) =>
                            setPriceY(parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          value={priceFontSize}
                          onChange={(e) =>
                            setPriceFontSize(parseInt(e.target.value) || 14)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 border rounded">
                    <div className="w-5"></div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">
                        Barcode Y (%)
                      </label>
                      <input
                        type="number"
                        value={barcodeY}
                        onChange={(e) =>
                          setBarcodeY(parseInt(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 border rounded">
                    <div className="w-5"></div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          SKU Y (%)
                        </label>
                        <input
                          type="number"
                          value={skuY}
                          onChange={(e) =>
                            setSkuY(parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          value={skuFontSize}
                          onChange={(e) =>
                            setSkuFontSize(parseInt(e.target.value) || 7)
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Label Options */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-3">Label Options</h3>

                  <div className="space-y-3">
                    {/* QR Code Toggle */}
                    <div className="flex items-center gap-3 p-3 border-2 rounded-lg hover:border-blue-300 transition-colors">
                      <input
                        type="checkbox"
                        id="useQRCode"
                        checked={useQRCode}
                        onChange={(e) => setUseQRCode(e.target.checked)}
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="useQRCode"
                          className="font-semibold cursor-pointer block"
                        >
                          {useQRCode ? "📱 QR Code" : "📊 Barcode"}
                        </label>
                        <p className="text-xs text-gray-600 mt-1">
                          {useQRCode
                            ? "Using QR code (scannable with phone cameras)"
                            : "Using traditional barcode"}
                        </p>
                      </div>
                    </div>

                    {/* Vertical Orientation Toggle */}
                    <div className="flex items-center gap-3 p-3 border-2 rounded-lg hover:border-purple-300 transition-colors">
                      <input
                        type="checkbox"
                        id="verticalOrientation"
                        checked={verticalOrientation}
                        onChange={(e) =>
                          setVerticalOrientation(e.target.checked)
                        }
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="verticalOrientation"
                          className="font-semibold cursor-pointer block"
                        >
                          {verticalOrientation
                            ? "📱 Vertical (90°)"
                            : "📏 Horizontal"}
                        </label>
                        <p className="text-xs text-gray-600 mt-1">
                          {verticalOrientation
                            ? "Label rotated 90° for vertical cards"
                            : "Standard horizontal layout"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-3">Label Size Presets</h3>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => {
                        setWidth(2.0);
                        setHeight(1.0);
                      }}
                      className={`p-2 border-2 rounded hover:bg-gray-50 text-sm transition-colors ${width === 2.0 && height === 1.0 ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                    >
                      Standard
                      <br />
                      <span className="text-xs text-gray-600">2×1"</span>
                    </button>
                    <button
                      onClick={() => {
                        setWidth(2.625);
                        setHeight(1.0);
                      }}
                      className={`p-2 border-2 rounded hover:bg-gray-50 text-sm transition-colors ${width === 2.625 && height === 1.0 ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                    >
                      Avery 5160
                      <br />
                      <span className="text-xs text-gray-600">2.625×1"</span>
                    </button>
                    <button
                      onClick={() => {
                        setWidth(4.0);
                        setHeight(2.0);
                      }}
                      className={`p-2 border-2 rounded hover:bg-gray-50 text-sm transition-colors ${width === 4.0 && height === 2.0 ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                    >
                      Thermal
                      <br />
                      <span className="text-xs text-gray-600">4×2"</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs mb-1">Width</label>
                        <input
                          type="number"
                          step="0.1"
                          value={width}
                          onChange={(e) =>
                            setWidth(parseFloat(e.target.value) || 2.0)
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Height</label>
                        <input
                          type="number"
                          step="0.1"
                          value={height}
                          onChange={(e) =>
                            setHeight(parseFloat(e.target.value) || 1.0)
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Spacing</label>
                        <input
                          type="number"
                          step="0.05"
                          value={spacing}
                          onChange={(e) =>
                            setSpacing(parseFloat(e.target.value) || 0.1)
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-2 mt-2">
                      <label className="block text-xs font-semibold mb-2 text-blue-700">
                        🎯 Printer Alignment
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs mb-1">
                            X Offset (→)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            value={offsetX}
                            onChange={(e) =>
                              setOffsetX(parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">
                            Y Offset (↓)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            value={offsetY}
                            onChange={(e) =>
                              setOffsetY(parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-2 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={onePerPage}
                          onChange={(e) => setOnePerPage(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">
                          📄 One label per page
                        </span>
                      </label>
                      <div className="text-xs text-gray-500 mt-1 ml-6">
                        For thermal printers
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-900">
                    {selectedItems.size} selected
                  </div>
                  <div className="text-xs text-blue-700">
                    {items.length} need labels
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    ✅ Already labeled items are hidden
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={toggleAll}
                    variant="outline"
                    className="w-full"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {allSelected
                      ? `Deselect All`
                      : `Select All ${items.length}`}
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={selectedItems.size === 0 || generating}
                    className="w-full bg-blue-600"
                    size="lg"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    {generating
                      ? "Generating..."
                      : `Generate ${selectedItems.size} Labels`}
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Items Needing Labels ({items.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {items.map((item) => {
                  const isSelected = selectedItems.has(item.sku);
                  return (
                    <div
                      key={item.sku}
                      onClick={() => toggleItem(item.sku)}
                      className={`p-3 border-2 rounded cursor-pointer text-sm ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1 flex-1">
                          <div className="font-semibold text-xs truncate">
                            {item.cardName}
                          </div>
                          {(item.quantity || 1) > 1 && (
                            <span className="text-xs font-bold bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded">
                              ×{item.quantity}
                            </span>
                          )}
                        </div>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        {item.setName}
                      </div>
                      <div className="text-sm font-bold text-green-600 mt-1">
                        ${(item.sellPrice || 0).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
