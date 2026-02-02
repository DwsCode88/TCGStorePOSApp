"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import { Download, FileText } from "lucide-react";

export default function ExportPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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
      setItems(loadedItems);
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIDs = (item: InventoryItem): string => {
    const game = item.game?.toLowerCase() || "";
    const isGraded =
      item.condition?.toLowerCase().includes("graded") ||
      item.notes?.toLowerCase().includes("graded") ||
      item.printing?.toLowerCase().includes("graded");

    // Single Cards - [683] Main
    const categories = ["683"];

    // Add game-specific category
    if (game.includes("one piece")) {
      categories.push("684"); // One Piece SUB
      if (isGraded) {
        categories.push("687"); // One Piece Graded SUB
      }
    } else if (game.includes("pokemon") || game.includes("pokémon")) {
      categories.push("686"); // Pokemon SUB
      if (isGraded) {
        categories.push("688"); // Pokemon Graded SUB
      }
    }

    return categories.join(",");
  };

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = () => {
    setExporting(true);

    try {
      const itemsToExport =
        selectedItems.size > 0
          ? items.filter((item) => selectedItems.has(item.sku))
          : items;

      if (itemsToExport.length === 0) {
        toast.error("No items to export");
        setExporting(false);
        return;
      }

      console.log(`📤 Exporting ${itemsToExport.length} items to CSV...`);

      // Log consignment items for verification
      const consignmentItems = itemsToExport.filter(
        (item) => item.acquisitionType === "consignment",
      );
      if (consignmentItems.length > 0) {
        console.log(`🤝 Found ${consignmentItems.length} consignment items`);
        consignmentItems.forEach((item) => {
          console.log(
            `  - ${item.cardName}: Vendor Code = ${item.customerVendorCode || "None"}`,
          );
        });
      }

      // CSV Headers (from the template)
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
        // Build product title
        const title = `${item.cardName}${item.setName ? ` - ${item.setName}` : ""}`;

        // Build short description
        const description = [item.game, item.printing, item.condition]
          .filter(Boolean)
          .join(" | ");

        return [
          getCategoryIDs(item), // Category IDs
          "TCGSingles", // Dept Code (fixed)
          "active", // Status
          title, // Product Title
          description, // Short Description
          "each", // Unit of Measurement
          "store", // Availability (store only)
          "no", // Unlimited Inventory
          "", // Options
          "", // Assigned option values
          item.sku, // sku
          item.sku, // upc (same as SKU)
          "", // Manufacturer Product Id
          "", // Alternate Lookups
          "", // Manufacturer
          // Primary Vendor - use customer vendor code for consignments, else default
          item.acquisitionType === "consignment" && item.customerVendorCode
            ? item.customerVendorCode
            : "5325102",
          "", // Serial Number
          "27891", // Store Location ID (fixed)
          "", // Weight
          (item.costBasis || 0).toFixed(2), // Default Cost
          (item.sellPrice || 0).toFixed(2), // Price
          "", // Sale Price
          "", // Wholesale Price
          "", // MAP Price
          "", // Wholesale Description
          (item.costBasis || 0).toFixed(2), // Cost
          (item.quantity || 1).toString(), // Inventory
          "", // Re-Order Point
          "", // Desired Stock Level
          "", // Case Unit Qty
          "items", // Retail Unit Type
          "", // Case Unit Type
          "", // Tax Code
          // Vendor Consignment - 'yes' for consignment items, 'no' otherwise
          item.acquisitionType === "consignment" ? "yes" : "no",
          "", // Alt Barcode Title
          "", // Bin Location (empty)
        ];
      });

      // Build CSV content
      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      // Create download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `vaulttrove-inventory-export-${timestamp}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${itemsToExport.length} items to CSV!`);
      console.log(`✅ Exported ${itemsToExport.length} items to ${filename}`);
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
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.sku)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg font-medium">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Export Inventory to CSV</h1>
        <p className="text-gray-600 mb-8">
          Export inventory in POS-compatible format
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Export Format</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>Categories:</strong>
            </p>
            <ul className="ml-4 space-y-1">
              <li>• One Piece → [683,684]</li>
              <li>• One Piece Graded → [683,684,687]</li>
              <li>• Pokemon → [683,686]</li>
              <li>• Pokemon Graded → [683,686,688]</li>
            </ul>
            <p className="mt-3">
              <strong>Dept Code:</strong> TCGSingles
            </p>
            <p>
              <strong>Store ID:</strong> 27891
            </p>
            <p>
              <strong>Vendor ID:</strong> 5325102
            </p>
            <p>
              <strong>Availability:</strong> Store only
            </p>
            <p>
              <strong>UPC:</strong> Same as SKU (for barcode scanning)
            </p>
            <p>
              <strong>Bin Location:</strong> Not included
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600">Total Items</div>
              <div className="text-3xl font-bold">{items.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Selected</div>
              <div className="text-3xl font-bold text-blue-600">
                {selectedItems.size}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Cards</div>
              <div className="text-3xl font-bold">
                {items.reduce((sum, item) => sum + (item.quantity || 1), 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={exportToCSV}
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting
              ? "Exporting..."
              : `Export ${selectedItems.size > 0 ? selectedItems.size : items.length} Items`}
          </Button>

          <Button onClick={toggleAll} variant="outline" size="lg">
            {selectedItems.size === items.length
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

        {/* Items List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Inventory Items</h2>

          {items.length === 0 ? (
            <p className="text-center py-12 text-gray-500">
              No items in inventory
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {items.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                return (
                  <div
                    key={item.sku}
                    onClick={() => toggleItem(item.sku)}
                    className={`border rounded p-3 cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
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
                        <div className="font-semibold">{item.cardName}</div>
                        <div className="text-sm text-gray-600">
                          {item.game} • {item.setName} • {item.condition}
                        </div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
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
