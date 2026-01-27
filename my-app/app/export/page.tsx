"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import { Download, History } from "lucide-react";

interface ExportBatch {
  id: string;
  batchNumber: string;
  exportedAt: Date;
  itemCount: number;
  totalCards: number;
  totalValue: number;
  itemSkus: string[];
  filename: string;
}

export default function ExportPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<ExportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBatches, setShowBatches] = useState(false);
  const [filter, setFilter] = useState<"not-exported" | "exported" | "all">(
    "not-exported",
  );

  useEffect(() => {
    loadInventory();
    loadBatches();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];
      setItems(loadedItems);
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const snapshot = await getDocs(collection(db, "exportBatches"));
      const loadedBatches = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        exportedAt: doc.data().exportedAt?.toDate() || new Date(),
      })) as ExportBatch[];

      loadedBatches.sort(
        (a, b) => b.exportedAt.getTime() - a.exportedAt.getTime(),
      );
      setBatches(loadedBatches);
    } catch (error: any) {
      console.error("Failed to load batches:", error);
    }
  };

  const getCategoryIDs = (item: InventoryItem): string => {
    const game = item.game?.toLowerCase() || "";
    const isGraded =
      item.condition?.toLowerCase().includes("graded") ||
      item.notes?.toLowerCase().includes("graded") ||
      item.printing?.toLowerCase().includes("graded");

    const categories = ["683"];

    if (game.includes("one piece")) {
      categories.push("684");
      if (isGraded) categories.push("687");
    } else if (game.includes("pokemon") || game.includes("pokémon")) {
      categories.push("686");
      if (isGraded) categories.push("688");
    }

    return categories.join(",");
  };

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = async () => {
    setExporting(true);

    try {
      const itemsToExport =
        selectedItems.size > 0
          ? items.filter((item) => selectedItems.has(item.sku))
          : items.filter((item) => !item.exportedAt);

      if (itemsToExport.length === 0) {
        toast.error("No items to export");
        setExporting(false);
        return;
      }

      console.log(`📤 Exporting ${itemsToExport.length} items...`);

      const batchNumber = `BATCH-${Date.now()}`;
      const timestamp = new Date();

      const headers = [
        "Category IDs (Comma separate)",
        "Dept Code",
        "Status",
        "Product Title",
        "Short Description",
        "Unit of Measurement(each/per yard)",
        "Availability(web/store/both)",
        "Unlimited Inventory(yes/no)",
        "Options",
        "Assigned option values",
        "sku",
        "upc",
        "Manufacturer Product Id",
        "Alternate Lookups",
        "Manufacturer",
        "Primary Vendor",
        "Serial Number",
        "Store Location ID",
        "Weight",
        "Default Cost",
        "Price",
        "Sale Price",
        "Wholesale Price",
        "MAP Price",
        "Wholesale Description",
        "Cost",
        "Inventory",
        "Re-Order Point",
        "Desired Stock Level",
        "Case Unit Qty",
        "Retail Unit Type(items,inches,feet,yards,meters)",
        "Case Unit Type(case,bolt,box,roll,pack)",
        "Tax Code",
        "Vendor Consignment (yes/no)",
        "Alt Barcode Title",
        "Bin Location",
      ];

      const rows = itemsToExport.map((item) => {
        const title = `${item.cardName}${item.setName ? ` - ${item.setName}` : ""}`;
        const description = [item.game, item.printing, item.condition]
          .filter(Boolean)
          .join(" | ");
        return [
          getCategoryIDs(item),
          "TCGSingles",
          "active",
          title,
          description,
          "each",
          "store",
          "no",
          "",
          "",
          item.sku,
          item.sku,
          "",
          "",
          "",
          "5325102",
          "",
          "27891",
          "",
          (item.costBasis || 0).toFixed(2),
          (item.sellPrice || 0).toFixed(2),
          "",
          "",
          "",
          "",
          (item.costBasis || 0).toFixed(2),
          (item.quantity || 1).toString(),
          "",
          "",
          "",
          "items",
          "",
          "",
          "no",
          "",
          "",
        ];
      });

      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      const dateStr = timestamp.toISOString().split("T")[0];
      const filename = `vaulttrove-export-${dateStr}-${batchNumber}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const totalCards = itemsToExport.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0,
      );
      const totalValue = itemsToExport.reduce(
        (sum, item) => sum + (item.sellPrice || 0) * (item.quantity || 1),
        0,
      );

      const batchRef = await addDoc(collection(db, "exportBatches"), {
        batchNumber,
        exportedAt: timestamp,
        itemCount: itemsToExport.length,
        totalCards,
        totalValue,
        itemSkus: itemsToExport.map((item) => item.sku),
        filename,
      });

      for (const item of itemsToExport) {
        await updateDoc(doc(db, "inventory", item.sku), {
          exportedAt: timestamp,
          exportBatchId: batchRef.id,
          exportBatchNumber: batchNumber,
        });
      }

      toast.success(
        `Exported ${itemsToExport.length} items in ${batchNumber}!`,
      );
      await loadInventory();
      await loadBatches();
      setSelectedItems(new Set());
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
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
    const visibleItems = getFilteredItems();
    if (selectedItems.size === visibleItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(visibleItems.map((item) => item.sku)));
    }
  };

  const getFilteredItems = () => {
    switch (filter) {
      case "not-exported":
        return items.filter((item) => !item.exportedAt);
      case "exported":
        return items.filter((item) => item.exportedAt);
      case "all":
        return items;
      default:
        return items;
    }
  };

  const filteredItems = getFilteredItems();
  const notExportedCount = items.filter((item) => !item.exportedAt).length;
  const exportedCount = items.filter((item) => item.exportedAt).length;

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Export Inventory to CSV</h1>
            <p className="text-gray-600">Export with batch tracking</p>
          </div>
          <Button
            onClick={() => setShowBatches(!showBatches)}
            variant="outline"
            size="lg"
          >
            <History className="w-4 h-4 mr-2" />
            {showBatches ? "Hide" : "View"} Export History
          </Button>
        </div>

        {showBatches && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Export History ({batches.length} batches)
            </h2>
            {batches.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No exports yet</p>
            ) : (
              <div className="space-y-3">
                {batches.map((batch) => (
                  <div key={batch.id} className="border rounded p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">
                          {batch.batchNumber}
                        </div>
                        <div className="text-sm text-gray-600">
                          {batch.exportedAt.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          {batch.itemCount} items • {batch.totalCards} cards • $
                          {batch.totalValue.toFixed(2)} value
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {batch.filename}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">📦 Batch Export System</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              ✅ After export, items are marked and won't show in default view
            </p>
            <p>✅ Each export creates a tracked batch with history</p>
            <p>✅ View all past exports with batch details</p>
            <p>✅ Filter to see exported, not exported, or all items</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600">Total Items</div>
              <div className="text-3xl font-bold">{items.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Not Exported</div>
              <div className="text-3xl font-bold text-green-600">
                {notExportedCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Already Exported</div>
              <div className="text-3xl font-bold text-gray-400">
                {exportedCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Selected</div>
              <div className="text-3xl font-bold text-blue-600">
                {selectedItems.size}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Show:</span>
            <Button
              onClick={() => setFilter("not-exported")}
              variant={filter === "not-exported" ? "default" : "outline"}
              size="sm"
            >
              Not Exported ({notExportedCount})
            </Button>
            <Button
              onClick={() => setFilter("exported")}
              variant={filter === "exported" ? "default" : "outline"}
              size="sm"
            >
              Exported ({exportedCount})
            </Button>
            <Button
              onClick={() => setFilter("all")}
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
            >
              All ({items.length})
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <Button
            onClick={exportToCSV}
            disabled={exporting || selectedItems.size === 0}
            className="bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting
              ? "Exporting..."
              : `Export ${selectedItems.size} Items as New Batch`}
          </Button>

          <Button onClick={toggleAll} variant="outline" size="lg">
            {selectedItems.size === filteredItems.length
              ? "Deselect All"
              : "Select All"}
          </Button>

          <Button
            onClick={() => setSelectedItems(new Set())}
            variant="outline"
            size="lg"
          >
            Clear Selection
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {filter === "not-exported"
              ? "Items Ready to Export"
              : filter === "exported"
                ? "Previously Exported Items"
                : "All Items"}
          </h2>

          {filteredItems.length === 0 ? (
            <p className="text-center py-12 text-gray-500">
              {filter === "not-exported"
                ? "No items ready to export"
                : "No items"}
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredItems.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                const isExported = !!item.exportedAt;
                return (
                  <div
                    key={item.sku}
                    onClick={() => toggleItem(item.sku)}
                    className={`border rounded p-3 cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : isExported
                          ? "border-gray-200 bg-gray-50"
                          : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{item.cardName}</div>
                          {isExported && (
                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                              Exported
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.game} • {item.setName} • {item.condition}
                        </div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                        {isExported && item.exportBatchNumber && (
                          <div className="text-xs text-gray-500 mt-1">
                            Batch: {item.exportBatchNumber}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        ${(item.sellPrice || 0).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Qty: {item.quantity || 1}
                      </div>
                      <div className="text-xs text-gray-500">
                        Cost: ${(item.costBasis || 0).toFixed(2)}
                      </div>
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
