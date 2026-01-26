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

export default function LabelsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("priced");

  // Label size
  const [width, setWidth] = useState(2.0);
  const [height, setHeight] = useState(1.0);
  const [spacing, setSpacing] = useState(0.1);
  const [offsetX, setOffsetX] = useState(0); // Horizontal offset in inches
  const [offsetY, setOffsetY] = useState(0); // Vertical offset in inches

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
      toast.success("Layout reset to defaults");
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];
      setItems(
        loadedItems.sort((a, b) => {
          if (a.status === "priced" && b.status !== "priced") return -1;
          if (a.status !== "priced" && b.status === "priced") return 1;
          return 0;
        }),
      );
      toast.success(`Loaded ${loadedItems.length} items`);
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
    const filtered = getFilteredItems();
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filtered.map((item) => item.sku)));
    }
  };

  const getFilteredItems = () => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  };

  const handleGenerate = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setGenerating(true);

    // Log positions RIGHT NOW
    console.clear();
    console.log("🎯 GENERATING WITH THESE POSITIONS:");
    console.log(`Store Y: ${storeY}% (${showStore ? "ON" : "OFF"})`);
    console.log(`Card Y: ${cardY}%`);
    console.log(`Set Y: ${setY}% (${showSet ? "ON" : "OFF"})`);
    console.log(`Price Y: ${priceY}%`);
    console.log(`Barcode Y: ${barcodeY}%`);
    console.log(`SKU Y: ${skuY}%`);
    console.log(`\n🎯 ZEBRA ALIGNMENT:`);
    console.log(`X Offset: ${offsetX}" (shift right)`);
    console.log(`Y Offset: ${offsetY}" (shift down)`);
    console.log("================\n");

    try {
      const itemsToLabel = items.filter((item) => selectedItems.has(item.sku));
      toast.loading(`Generating ${itemsToLabel.length} labels...`);

      // Generate PDF RIGHT HERE inline
      const labelWidthWithMargin = width + spacing;
      const labelHeightWithMargin = height + spacing;
      const labelsPerRow = Math.floor(8.5 / labelWidthWithMargin);
      const labelsPerCol = Math.floor(11 / labelHeightWithMargin);
      const labelsPerPage = labelsPerRow * labelsPerCol;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: "letter",
      });

      for (let i = 0; i < itemsToLabel.length; i++) {
        if (i > 0 && i % labelsPerPage === 0) {
          pdf.addPage();
        }

        const item = itemsToLabel[i];
        const labelIndex = i % labelsPerPage;
        const row = Math.floor(labelIndex / labelsPerRow);
        const col = labelIndex % labelsPerRow;

        // Apply offsets to center content on physical label
        const labelX = col * labelWidthWithMargin + offsetX;
        const labelY = row * labelHeightWithMargin + offsetY;

        const leftMargin = 0.1; // 0.1 inches from left edge

        console.log(`Label ${i + 1}: "${item.cardName}"`);

        // VaultTrove
        if (showStore) {
          const y = labelY + (storeY / 100) * height;
          console.log(`  Store at Y=${y.toFixed(3)}" (${storeY}%)`);
          pdf.setFontSize(storeFontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text("VaultTrove", labelX + leftMargin, y);
        }

        // Card name
        const cardYPos = labelY + (cardY / 100) * height;
        console.log(`  Card at Y=${cardYPos.toFixed(3)}" (${cardY}%)`);
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
          console.log(`  Set at Y=${setYPos.toFixed(3)}" (${setY}%)`);
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
        console.log(`  Price at Y=${priceYPos.toFixed(3)}" (${priceY}%)`);
        pdf.setFontSize(priceFontSize);
        pdf.setFont("helvetica", "bold");
        pdf.text(
          `${item.condition || "NM"}  $${(item.sellPrice || 0).toFixed(2)}`,
          labelX + leftMargin,
          priceYPos,
        );

        // Barcode
        const barcodeYPos = labelY + (barcodeY / 100) * height;
        console.log(`  Barcode at Y=${barcodeYPos.toFixed(3)}" (${barcodeY}%)`);
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
        console.log(`  SKU at Y=${skuYPos.toFixed(3)}" (${skuY}%)`);
        pdf.setFontSize(skuFontSize);
        pdf.setFont("courier", "normal");
        pdf.text(item.sku, labelX + width / 2, skuYPos, { align: "center" });

        console.log("");
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

      await Promise.all(
        itemsToLabel.map((item) =>
          updateDoc(doc(db, "inventory", item.sku), {
            status: "labeled",
            updatedAt: new Date(),
          }),
        ),
      );

      setItems(
        items.map((item) =>
          selectedItems.has(item.sku)
            ? { ...item, status: "labeled" as const }
            : item,
        ),
      );

      console.log("✅ DONE\n");
      toast.success(`Generated ${itemsToLabel.length} labels!`);
      setSelectedItems(new Set());
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const filteredItems = getFilteredItems();
  const allSelected =
    filteredItems.length > 0 && selectedItems.size === filteredItems.length;

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
        <h1 className="text-4xl font-bold mb-2">Print Labels - SIMPLE MODE</h1>
        <p className="text-gray-600 mb-6">
          Direct control - change numbers, see results
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Position Controls */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Label Layout (Direct Control)
              </h2>
              <div className="flex gap-2">
                <Button onClick={saveLayout} variant="outline" size="sm">
                  💾 Save Layout
                </Button>
                <Button onClick={resetLayout} variant="outline" size="sm">
                  🔄 Reset
                </Button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm">
              <strong>Your layout auto-saves!</strong> Click "💾 Save Layout" to
              remember these settings.
            </div>

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
                      Store Name Y Position (%)
                    </label>
                    <input
                      type="number"
                      value={storeY}
                      onChange={(e) => setStoreY(parseInt(e.target.value) || 0)}
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
                <div className="text-xs text-gray-600">VaultTrove</div>
              </div>

              {/* Card */}
              <div className="flex items-center gap-4 p-3 border rounded">
                <div className="w-5"></div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Card Name Y Position (%)
                    </label>
                    <input
                      type="number"
                      value={cardY}
                      onChange={(e) => setCardY(parseInt(e.target.value) || 0)}
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
                <div className="text-xs text-gray-600">Card Name</div>
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
                      Set Name Y Position (%)
                    </label>
                    <input
                      type="number"
                      value={setY}
                      onChange={(e) => setSetY(parseInt(e.target.value) || 0)}
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
                <div className="text-xs text-gray-600">Set Name</div>
              </div>

              {/* Price */}
              <div className="flex items-center gap-4 p-3 border rounded">
                <div className="w-5"></div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Price Y Position (%)
                    </label>
                    <input
                      type="number"
                      value={priceY}
                      onChange={(e) => setPriceY(parseInt(e.target.value) || 0)}
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
                <div className="text-xs text-gray-600">Price</div>
              </div>

              {/* Barcode */}
              <div className="flex items-center gap-4 p-3 border rounded">
                <div className="w-5"></div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Barcode Y Position (%)
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
                  <div className="text-xs text-gray-600 flex items-center">
                    (Fixed size: 85% width × 12% height)
                  </div>
                </div>
                <div className="text-xs text-gray-600">Barcode</div>
              </div>

              {/* SKU */}
              <div className="flex items-center gap-4 p-3 border rounded">
                <div className="w-5"></div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      SKU Y Position (%)
                    </label>
                    <input
                      type="number"
                      value={skuY}
                      onChange={(e) => setSkuY(parseInt(e.target.value) || 0)}
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
                <div className="text-xs text-gray-600">SKU (centered)</div>
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
                    🎯 Zebra Printer Alignment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1">X Offset (→)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={offsetX}
                        onChange={(e) =>
                          setOffsetX(parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Move right →
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Y Offset (↓)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={offsetY}
                        onChange={(e) =>
                          setOffsetY(parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Move down ↓
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 bg-blue-50 p-2 rounded">
                    <strong>Tip:</strong> Print 1 label. Too far left? Increase
                    X. Too high? Increase Y.
                  </div>
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Filter</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="all">All Items</option>
                <option value="priced">Ready to Label</option>
                <option value="pending">Pending</option>
                <option value="labeled">Already Labeled</option>
              </select>
            </div>

            {/* Stats */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900">
                {selectedItems.size} selected
              </div>
              <div className="text-xs text-blue-700">
                {filteredItems.length} available
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button onClick={toggleAll} variant="outline" className="w-full">
                <CheckSquare className="w-4 h-4 mr-2" />
                {allSelected ? "Deselect All" : "Select All"}
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
              <p className="text-xs text-gray-600 text-center">
                Press F12 to see console output
              </p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Items ({filteredItems.length})
          </h2>
          {filteredItems.length === 0 ? (
            <p className="text-center py-12 text-gray-500">No items</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredItems.map((item) => {
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
                      <div className="font-semibold text-xs truncate flex-1">
                        {item.cardName}
                      </div>
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
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
          )}
        </div>
      </div>
    </div>
  );
}
