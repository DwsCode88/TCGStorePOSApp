"use client";

import { useState, useEffect } from "react";
import {


  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";

interface InventoryItem {
  sku: string;
  cardName?: string;
  name?: string;
  setName?: string;
  set?: string;
  game?: string;
  condition?: string;
  printing?: string;
  sellPrice?: number;
  quantity?: number;
  acquisitionType?: string;
  vendorCode?: string;
  customerVendorCode?: string;
  exportedAt?: any;
  exportBatchId?: string;
  [key: string]: any;
}

export const dynamic = 'force-dynamic';

export default function ExportPage() {
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "exported">("pending");
  const [batchName, setBatchName] = useState("");

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];
      setAllItems(loadedItems);
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on export status
  const pendingItems = allItems.filter((item) => !item.exportedAt);
  const exportedItems = allItems.filter((item) => item.exportedAt);

  const displayItems = activeTab === "pending" ? pendingItems : exportedItems;

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

  const exportToCSV = async (markAsExported: boolean = true) => {
    setExporting(true);

    try {
      const itemsToExport =
        selectedItems.size > 0
          ? displayItems.filter((item) => selectedItems.has(item.sku))
          : displayItems;

      if (itemsToExport.length === 0) {
        toast.error("No items to export");
        setExporting(false);
        return;
      }

      const timestamp = new Date().toISOString();
      const batchId = batchName.trim() || `batch-${timestamp.split("T")[0]}`;

      console.log(`📤 Exporting ${itemsToExport.length} items to CSV...`);

      // CSV Headers
      const headers = [
        "SKU",
        "TCGplayer Id",
        "Product Line",
        "Set Name",
        "Product Name",
        "Title",
        "Number",
        "Rarity",
        "Condition",
        "TCG Market Price",
        "TCG Direct Low",
        "TCG Low Price With Shipping",
        "TCG Low Price",
        "Total Quantity",
        "Add to Quantity",
        "Printing",
        "Language",
        "Price",
        "Photo URL",
        "Category IDs",
        "VENDOR_CODE",
      ];

      // CSV Rows
      const rows = itemsToExport.map((item) => {
        const vendorCode = item.vendorCode || item.customerVendorCode || "";

        return [
          escapeCSV(item.sku),
          escapeCSV(item.tcgplayerId || ""),
          escapeCSV(item.game || ""),
          escapeCSV(item.setName || item.set || ""),
          escapeCSV(item.cardName || item.name || ""),
          escapeCSV(item.cardName || item.name || ""),
          escapeCSV(item.number || ""),
          escapeCSV(item.rarity || ""),
          escapeCSV(item.condition || "Near Mint"),
          escapeCSV(item.marketPrice || item.sellPrice || ""),
          "",
          "",
          "",
          escapeCSV(item.quantity || 1),
          escapeCSV(item.quantity || 1),
          escapeCSV(item.printing || "Normal"),
          escapeCSV(item.language || "English"),
          escapeCSV(item.sellPrice || ""),
          escapeCSV(item.imageUrl || ""),
          getCategoryIDs(item),
          escapeCSV(vendorCode),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      // Create download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      const filename = `vaulttrove-${batchId}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Mark as exported in Firebase
      if (markAsExported) {
        const batch = writeBatch(db);

        itemsToExport.forEach((item) => {
          const docRef = doc(db, "inventory", item.sku);
          batch.update(docRef, {
            exportedAt: serverTimestamp(),
            exportBatchId: batchId,
            lastExportDate: timestamp,
          });
        });

        await batch.commit();
        console.log(`✅ Marked ${itemsToExport.length} items as exported`);

        // Reload to update UI
        await loadInventory();
        setSelectedItems(new Set());
      }

      toast.success(`Exported ${itemsToExport.length} items to ${filename}!`);
      console.log(`✅ Exported ${itemsToExport.length} items to ${filename}`);
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const markAsNotExported = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select items to mark as not exported");
      return;
    }

    try {
      const batch = writeBatch(db);

      selectedItems.forEach((sku) => {
        const docRef = doc(db, "inventory", sku);
        batch.update(docRef, {
          exportedAt: null,
          exportBatchId: null,
          lastExportDate: null,
        });
      });

      await batch.commit();
      toast.success(`Marked ${selectedItems.size} items as not exported`);

      await loadInventory();
      setSelectedItems(new Set());
    } catch (error: any) {
      console.error("Failed to update:", error);
      toast.error("Failed to update items");
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

  const selectAll = () => {
    setSelectedItems(new Set(displayItems.map((item) => item.sku)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg font-medium">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Export Inventory
          </h1>
          <p className="text-gray-600">Export cards to TCGPlayer CSV format</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-orange-600">
              {pendingItems.length}
            </div>
            <div className="text-sm text-gray-600">Ready to Export</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600">
              {exportedItems.length}
            </div>
            <div className="text-sm text-gray-600">Already Exported</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600">
              {selectedItems.size}
            </div>
            <div className="text-sm text-gray-600">Selected</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab("pending");
                  setSelectedItems(new Set());
                }}
                className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === "pending"
                    ? "border-orange-600 text-orange-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                📦 Ready to Export ({pendingItems.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("exported");
                  setSelectedItems(new Set());
                }}
                className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === "exported"
                    ? "border-green-600 text-green-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                ✅ Exported History ({exportedItems.length})
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6">
            {activeTab === "pending" ? (
              <>
                {/* Batch Name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Name (optional)
                  </label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g., weekly-export, new-arrivals"
                    className="w-full border border-gray-300 rounded px-4 py-2"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    If not provided, will use: batch-
                    {new Date().toISOString().split("T")[0]}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => exportToCSV(true)}
                    disabled={exporting || displayItems.length === 0}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    {exporting
                      ? "⏳ Exporting..."
                      : `📤 Export ${selectedItems.size > 0 ? selectedItems.size : displayItems.length} Cards & Mark as Exported`}
                  </button>

                  <button
                    onClick={() => exportToCSV(false)}
                    disabled={exporting || displayItems.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    📥 Export Without Marking
                  </button>

                  <button
                    onClick={
                      selectedItems.size === displayItems.length
                        ? deselectAll
                        : selectAll
                    }
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg"
                  >
                    {selectedItems.size === displayItems.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Exported Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => exportToCSV(false)}
                    disabled={exporting || displayItems.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    {exporting
                      ? "⏳ Exporting..."
                      : `📥 Re-export ${selectedItems.size > 0 ? selectedItems.size : displayItems.length} Cards`}
                  </button>

                  <button
                    onClick={markAsNotExported}
                    disabled={selectedItems.size === 0}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    🔄 Mark {selectedItems.size} as Not Exported
                  </button>

                  <button
                    onClick={
                      selectedItems.size === displayItems.length
                        ? deselectAll
                        : selectAll
                    }
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg"
                  >
                    {selectedItems.size === displayItems.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
              </>
            )}

            {/* Selection Info */}
            {selectedItems.size > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                {selectedItems.size} card{selectedItems.size !== 1 ? "s" : ""}{" "}
                selected
              </div>
            )}
          </div>
        </div>

        {/* Cards List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {displayItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">
                {activeTab === "pending" ? "📦" : "✅"}
              </div>
              <div className="text-xl font-semibold mb-2">
                {activeTab === "pending"
                  ? "All cards have been exported!"
                  : "No exported cards yet"}
              </div>
              <div className="text-sm">
                {activeTab === "pending"
                  ? 'Check the "Exported History" tab to see exported cards'
                  : "Cards will appear here after you export them"}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left p-3 w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedItems.size === displayItems.length &&
                          displayItems.length > 0
                        }
                        onChange={() =>
                          selectedItems.size === displayItems.length
                            ? deselectAll()
                            : selectAll()
                        }
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left p-3">Card</th>
                    <th className="text-left p-3">Set</th>
                    <th className="text-left p-3">Condition</th>
                    <th className="text-right p-3">Price</th>
                    <th className="text-center p-3">Qty</th>
                    {activeTab === "exported" && (
                      <>
                        <th className="text-left p-3">Batch</th>
                        <th className="text-left p-3">Exported</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => (
                    <tr
                      key={item.sku}
                      className={`border-b hover:bg-gray-50 cursor-pointer ${
                        selectedItems.has(item.sku) ? "bg-blue-50" : ""
                      }`}
                      onClick={() => toggleItem(item.sku)}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.sku)}
                          onChange={() => toggleItem(item.sku)}
                          className="w-4 h-4"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">
                          {item.cardName || item.name}
                        </div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                      </td>
                      <td className="p-3 text-gray-600">
                        {item.setName || item.set}
                      </td>
                      <td className="p-3 text-gray-600">{item.condition}</td>
                      <td className="p-3 text-right font-semibold text-green-600">
                        ${(item.sellPrice || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">{item.quantity || 1}</td>
                      {activeTab === "exported" && (
                        <>
                          <td className="p-3 text-xs text-gray-600">
                            {item.exportBatchId || "-"}
                          </td>
                          <td className="p-3 text-xs text-gray-600">
                            {item.exportedAt
                              ? new Date(
                                  item.exportedAt.seconds * 1000,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
