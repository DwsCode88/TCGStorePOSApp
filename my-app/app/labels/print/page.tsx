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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Label size
  const [width, setWidth] = useState(2.0);
  const [height, setHeight] = useState(1.0);
  const [spacing, setSpacing] = useState(0.1);
  const [offsetX, setOffsetX] = useState(0); // Horizontal offset in inches
  const [offsetY, setOffsetY] = useState(0); // Vertical offset in inches
  const [onePerPage, setOnePerPage] = useState(true); // One label per page option - default true for thermal printers

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
      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];

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

      // Filter to only show items that need labels (status = "priced")
      // Exclude labeled and listed items
      const needsLabels = loadedItems.filter(
        (item) => item.status === "priced",
      );
      const excludedCount = loadedItems.length - needsLabels.length;

      console.log(`\n🏷️ LABEL QUEUE (Auto-filtered):`);
      console.log(`  Items that need labels (priced): ${needsLabels.length}`);
      console.log(
        `  Items excluded (already labeled/listed/pending): ${excludedCount}`,
      );

      console.log(`\nItems that need labels:`);
      needsLabels.forEach((item, i) => {
        console.log(
          `  ${i + 1}. ${item.cardName} (${item.sku}) - Status: ${item.status}`,
        );
      });
      console.log("");

      setItems(
        needsLabels.sort((a, b) => {
          if (a.status === "priced" && b.status !== "priced") return -1;
          if (a.status !== "priced" && b.status === "priced") return 1;
          return 0;
        }),
      );

      if (needsLabels.length > 0) {
        toast.success(
          `${needsLabels.length} items need labels (${excludedCount} already done)`,
        );
      } else {
        toast.success(`✅ All caught up! No items need labels.`);
      }
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
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

    // Show confirmation with details
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

    // Expand items by quantity
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

      // Generate PDF
      const labelWidthWithMargin = width + spacing;
      const labelHeightWithMargin = height + spacing;

      let labelsPerRow, labelsPerCol, labelsPerPage;

      if (onePerPage) {
        labelsPerRow = 1;
        labelsPerCol = 1;
        labelsPerPage = 1;
        console.log("📄 ONE LABEL PER PAGE mode");
      } else {
        labelsPerRow = Math.floor(8.5 / labelWidthWithMargin);
        labelsPerCol = Math.floor(11 / labelHeightWithMargin);
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

        // VaultTrove
        if (showStore) {
          const y = labelY + (storeY / 100) * height;
          pdf.setFontSize(storeFontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text("VaultTrove", labelX + leftMargin, y);
        }

        // Card name
        const cardYPos = labelY + (cardY / 100) * height;
        pdf.setFontSize(cardFontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          (item.cardName || "Unknown").substring(0, 30),
          labelX + leftMargin,
          cardYPos,
        );

        // Set name
        if (showSet) {
          const setYPos = labelY + (setY / 100) * height;
          pdf.setFontSize(setFontSize);
          pdf.setFont("helvetica", "normal");
          const setInfo = item.setName || "Unknown Set";
          const printing =
            item.printing && item.printing !== "Normal"
              ? ` (${item.printing})`
              : "";
          pdf.text(
            `${setInfo}${printing}`.substring(0, 35),
            labelX + leftMargin,
            setYPos,
          );
        }

        // Price
        const priceYPos = labelY + (priceY / 100) * height;
        pdf.setFontSize(priceFontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          `${item.condition || "NM"}  $${(item.sellPrice || 0).toFixed(2)}`,
          labelX + leftMargin,
          priceYPos,
        );

        // Barcode
        const barcodeYPos = labelY + (barcodeY / 100) * height;
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
            labelX + leftMargin,
            barcodeYPos,
            width * 0.85,
            height * 0.12,
          );
        } catch (e) {
          console.error("Barcode error:", e);
        }

        // SKU
        const skuYPos = labelY + (skuY / 100) * height;
        pdf.setFontSize(skuFontSize);
        pdf.setFont("courier", "normal");
        pdf.text(item.sku, labelX + width / 2, skuYPos, { align: "center" });
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

      // Mark items as labeled
      await Promise.all(
        itemsToLabel.map((item) =>
          updateDoc(doc(db, "inventory", item.sku), {
            status: "labeled",
            updatedAt: new Date(),
          }),
        ),
      );

      console.log("✅ Labels generated and items marked as labeled");
      toast.success(
        `Generated ${expandedItems.length} labels! Items removed from queue.`,
      );

      // Reload inventory to remove labeled items from list
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
        <p className="text-gray-600 mb-6">
          Showing only items that need labels (status: "priced")
        </p>

        {/* All Caught Up Message */}
        {items.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center mb-6">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              All caught up!
            </h2>
            <p className="text-gray-600 mb-4">
              No items need labels. All priced items have already been labeled.
            </p>
            <p className="text-sm text-gray-500">
              Add new items or check the inventory page to see labeled items.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Position Controls */}
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
                  <strong>ℹ️ Only showing items that need labels</strong> -
                  Already labeled and listed items are automatically hidden.
                </div>

                {/* Selected items preview - keeping all your existing UI */}
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

                {/* All your existing layout controls */}
                <div className="space-y-4">
                  {/* Store */}
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

                  {/* Card */}
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

                  {/* Set */}
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

                  {/* Price */}
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

                  {/* Barcode */}
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

                  {/* SKU */}
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

              {/* Settings & Actions */}
              <div className="space-y-4">
                {/* Size */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-3">Label Size</h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => {
                        setWidth(2.0);
                        setHeight(1.0);
                      }}
                      className="p-2 border rounded hover:bg-gray-50 text-sm"
                    >
                      Standard
                      <br />
                      <span className="text-xs text-gray-600">2×1"</span>
                    </button>
                    <button
                      onClick={() => {
                        setWidth(4.0);
                        setHeight(2.0);
                      }}
                      className="p-2 border rounded hover:bg-gray-50 text-sm"
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

                {/* Stats */}
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

                {/* Actions */}
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

            {/* Items Grid */}
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
