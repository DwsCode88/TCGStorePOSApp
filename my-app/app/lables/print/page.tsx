"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import { generateLabelPDF } from "@/lib/labels/generator";
import { Printer, Download, CheckSquare, Square } from "lucide-react";

export default function PrintLabelsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [labelSize, setLabelSize] = useState<"standard" | "large" | "custom">(
    "standard",
  );
  const [customWidth, setCustomWidth] = useState(2.0);
  const [customHeight, setCustomHeight] = useState(1.0);
  const [statusFilter, setStatusFilter] = useState<string>("priced");

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const inventoryRef = collection(db, "inventory");
      const snapshot = await getDocs(inventoryRef);

      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];

      // Sort by status (priced items first)
      const sorted = loadedItems.sort((a, b) => {
        if (a.status === "priced" && b.status !== "priced") return -1;
        if (a.status !== "priced" && b.status === "priced") return 1;
        return 0;
      });

      setItems(sorted);
      toast.success(`Loaded ${sorted.length} items`);
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
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

  const handleGenerateLabels = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setGenerating(true);
    try {
      // Get selected items
      const itemsToLabel = items.filter((item) => selectedItems.has(item.sku));

      console.log(`Generating ${itemsToLabel.length} labels...`);
      toast.loading(`Generating ${itemsToLabel.length} labels...`);

      // Determine template to use
      const template =
        labelSize === "custom"
          ? { width: customWidth, height: customHeight }
          : labelSize;

      // Generate PDF
      const pdfBlob = await generateLabelPDF(itemsToLabel, template);

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `labels-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update status to 'labeled'
      const updatePromises = itemsToLabel.map((item) =>
        updateDoc(doc(db, "inventory", item.sku), {
          status: "labeled",
          updatedAt: new Date(),
        }),
      );
      await Promise.all(updatePromises);

      // Update local state
      setItems(
        items.map((item) =>
          selectedItems.has(item.sku)
            ? { ...item, status: "labeled" as const }
            : item,
        ),
      );

      toast.success(`Generated ${itemsToLabel.length} labels!`);
      setSelectedItems(new Set());
    } catch (error: any) {
      console.error("Failed to generate labels:", error);
      toast.error(`Failed to generate labels: ${error.message}`);
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
        <div className="text-center">
          <div className="text-lg font-medium">Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Print Labels</h1>
          <p className="text-gray-600">
            Select items to print price labels with barcodes
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Items</option>
                <option value="priced">Ready to Label (Priced)</option>
                <option value="pending">Pending</option>
                <option value="labeled">Already Labeled</option>
                <option value="listed">Listed in POS</option>
              </select>
            </div>

            {/* Selection Info */}
            <div className="flex items-end">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                <div className="text-sm font-medium text-blue-900">
                  {selectedItems.size} selected
                </div>
                <div className="text-xs text-blue-700">
                  {filteredItems.length} available
                </div>
              </div>
            </div>
          </div>

          {/* Label Size Configuration */}
          <div className="border-t pt-4 mb-4">
            <label className="block text-sm font-medium mb-3">Label Size</label>

            {/* Preset Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <button
                onClick={() => {
                  setLabelSize("standard");
                  setCustomWidth(2.0);
                  setCustomHeight(1.0);
                }}
                className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                  labelSize === "standard"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="font-semibold">Standard</div>
                <div className="text-xs text-gray-600">2.0" × 1.0"</div>
                <div className="text-xs text-gray-500">Avery 5160</div>
              </button>

              <button
                onClick={() => {
                  setLabelSize("large");
                  setCustomWidth(2.25);
                  setCustomHeight(1.25);
                }}
                className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                  labelSize === "large"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="font-semibold">Large</div>
                <div className="text-xs text-gray-600">2.25" × 1.25"</div>
                <div className="text-xs text-gray-500">Avery 5163</div>
              </button>

              <button
                onClick={() => {
                  setLabelSize("custom");
                  setCustomWidth(4.0);
                  setCustomHeight(2.0);
                }}
                className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                  labelSize === "custom" &&
                  customWidth === 4.0 &&
                  customHeight === 2.0
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="font-semibold">Dymo 4×2</div>
                <div className="text-xs text-gray-600">4.0" × 2.0"</div>
                <div className="text-xs text-gray-500">Thermal</div>
              </button>

              <button
                onClick={() => {
                  setLabelSize("custom");
                  setCustomWidth(4.0);
                  setCustomHeight(3.0);
                }}
                className={`p-3 border-2 rounded-lg text-sm font-medium transition ${
                  labelSize === "custom" &&
                  customWidth === 4.0 &&
                  customHeight === 3.0
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="font-semibold">Dymo 4×3</div>
                <div className="text-xs text-gray-600">4.0" × 3.0"</div>
                <div className="text-xs text-gray-500">Thermal</div>
              </button>
            </div>

            {/* Custom Size Inputs */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={labelSize === "custom"}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setLabelSize("custom");
                    } else {
                      setLabelSize("standard");
                      setCustomWidth(2.0);
                      setCustomHeight(1.0);
                    }
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <label className="text-sm font-medium">Custom Size</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Width (inches)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="8"
                    value={customWidth}
                    onChange={(e) => {
                      setCustomWidth(parseFloat(e.target.value));
                      setLabelSize("custom");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Height (inches)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="6"
                    value={customHeight}
                    onChange={(e) => {
                      setCustomHeight(parseFloat(e.target.value));
                      setLabelSize("custom");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-600">
                Current: {customWidth}" × {customHeight}"
                {labelSize !== "custom" && " (using preset)"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={toggleAll} variant="outline" className="flex-1">
              <CheckSquare className="w-4 h-4 mr-2" />
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            <Button
              onClick={handleGenerateLabels}
              disabled={selectedItems.size === 0 || generating}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Printer className="w-4 h-4 mr-2" />
              {generating
                ? "Generating..."
                : `Generate ${selectedItems.size} Labels`}
            </Button>
          </div>
        </div>

        {/* Item Selection Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Select Items</h2>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Printer className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No items to label</p>
              <p className="text-sm mt-1">
                {statusFilter === "priced"
                  ? "Add items via the Intake page first"
                  : "Try changing the status filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                return (
                  <div
                    key={item.sku}
                    onClick={() => toggleItem(item.sku)}
                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 bg-white"
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <div className="absolute top-3 right-3">
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-blue-600" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-300" />
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="pr-8">
                      <div className="font-semibold text-gray-900 mb-1">
                        {item.cardName}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {item.setName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {item.sku}
                        </span>
                        <span className="font-semibold">{item.condition}</span>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-lg font-bold text-green-600">
                          ${(item.sellPrice || 0).toFixed(2)}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            item.status === "priced"
                              ? "bg-yellow-100 text-yellow-800"
                              : item.status === "labeled"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status || "pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">📋 How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Select items by clicking the cards</li>
            <li>• Choose label size (standard or large)</li>
            <li>• Click "Generate Labels" to create PDF</li>
            <li>• PDF downloads automatically</li>
            <li>• Print on Avery 5160 (standard) or similar labels</li>
            <li>• Items are marked as "labeled" after printing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
