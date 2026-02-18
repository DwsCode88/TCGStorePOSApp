"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface InventoryItem {
  sku: string;
  cardName: string;
  setName: string;
  condition: string;
  sellPrice: number;
  quantity?: number;
  printing?: string;
}

export default function SquareCSVExportPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("VaultTrove");

  useEffect(() => {
    loadSettings();
    loadInventory();
  }, []);

  const loadSettings = () => {
    const saved = localStorage.getItem("squareLocationName");
    if (saved) setLocationName(saved);
  };

  const saveSettings = () => {
    localStorage.setItem("squareLocationName", locationName);
    toast.success("Location name saved!");
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const loadedItems = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            ...data,
            sku: data.sku || doc.id,
          };
        })
        .filter(
          (item: any) => item.status === "priced" || item.status === "labeled",
        ) as InventoryItem[];

      setItems(loadedItems);
      toast.success(`Loaded ${loadedItems.length} items ready to export`);
    } catch (error: any) {
      toast.error("Failed to load items");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportToSquareCSV = () => {
    if (items.length === 0) {
      toast.error("No items to export");
      return;
    }

    // Square CSV format headers
    const headers = [
      "Token",
      "Item Name",
      "Customer-facing Name",
      "Variation Name",
      "SKU",
      "Description",
      "Categories",
      "Reporting Category",
      "SEO Title",
      "SEO Description",
      "Permalink",
      "GTIN",
      "Square Online Item Visibility",
      "Item Type",
      "Weight (lb)",
      "Social Media Link Title",
      "Social Media Link Description",
      "Shipping Enabled",
      "Self-serve Ordering Enabled",
      "Delivery Enabled",
      "Pickup Enabled",
      "Price",
      "Online Sale Price",
      "Archived",
      "Sellable",
      "Contains Alcohol",
      "Stockable",
      "Skip Detail Screen in POS",
      "Option Name 1",
      "Option Value 1",
      `Current Quantity ${locationName}`,
      `New Quantity ${locationName}`,
      `Stock Alert Enabled ${locationName}`,
      `Stock Alert Count ${locationName}`,
    ];

    // Convert items to CSV rows
    const rows = items.map((item) => {
      const price = item.sellPrice.toFixed(2);
      const quantity = item.quantity || 1;
      const description = `${item.setName}${item.printing ? ` - ${item.printing}` : ""} - ${item.condition}`;

      return [
        "", // Token (empty for new items)
        item.cardName, // Item Name
        item.cardName, // Customer-facing Name
        item.condition, // Variation Name
        item.sku, // SKU
        description, // Description
        "Trading Cards", // Categories
        "Trading Cards", // Reporting Category
        "", // SEO Title
        "", // SEO Description
        "", // Permalink
        "", // GTIN (empty)
        "Visible", // Square Online Item Visibility
        "Physical", // Item Type
        "0.01", // Weight (lb)
        "", // Social Media Link Title
        "", // Social Media Link Description
        "N", // Shipping Enabled
        "Y", // Self-serve Ordering Enabled
        "N", // Delivery Enabled
        "Y", // Pickup Enabled
        price, // Price
        "", // Online Sale Price
        "N", // Archived
        "Y", // Sellable
        "N", // Contains Alcohol
        "Y", // Stockable
        "N", // Skip Detail Screen in POS
        "", // Option Name 1
        "", // Option Value 1
        "", // Current Quantity
        quantity.toString(), // New Quantity
        "N", // Stock Alert Enabled
        "", // Stock Alert Count
      ];
    });

    // Create CSV content with instructions
    const instructions1 = "Instructions";
    const instructions2 =
      "Fill in your catalog information below. Avoid some of the most common errors by making sure: 1) each row contains an item name; 2) an item and its variations have the same category and description; 3) GTINs are 8,12, 13, or 14 characters and contain numbers only; and 4) every item referencing an option set has both an option set name and an option value.";

    const csvLines = [
      [instructions1].concat(Array(headers.length - 1).fill("")),
      [instructions2].concat(Array(headers.length - 1).fill("")),
      Array(headers.length).fill(""),
      headers,
      ...rows,
    ];

    // Escape and quote CSV fields
    const escapeCsvField = (field: string | number): string => {
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = csvLines
      .map((row) => row.map(escapeCsvField).join(","))
      .join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `square-catalog-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${items.length} items to CSV!`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Export to Square CSV</h1>
            <p className="text-gray-600">
              Download CSV for manual Square import
            </p>
          </div>
          <Button onClick={loadInventory} variant="outline" disabled={loading}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Location Settings</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              ⚠️ Important: Location Name Must Match Square
            </h3>
            <p className="text-sm text-yellow-800 mb-2">
              The location name below <strong>must exactly match</strong> your
              Square location name or quantities won't import.
            </p>
            <p className="text-sm text-yellow-800">
              <strong>How to find it:</strong> Square Dashboard → Account &
              Settings → Business → Locations → Copy the exact name
            </p>
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-2">
              Square Location Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg font-mono"
                placeholder="VaultTrove"
              />
              <Button onClick={saveSettings}>Save</Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Column headers: "New Quantity <strong>{locationName}</strong>"
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Ready to Export</h2>
              <p className="text-sm text-gray-600">
                {items.length} items •{" "}
                {items.reduce((sum, i) => sum + (i.quantity || 1), 0)} total
                cards • Priced and Labeled items only
              </p>
            </div>
            <Button
              onClick={exportToSquareCSV}
              disabled={loading || items.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Square CSV
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              📋 How to Import to Square:
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside mb-3">
              <li>Click "Download Square CSV" above</li>
              <li>Go to Square Dashboard → Items → Import</li>
              <li>Upload the downloaded CSV file</li>
              <li>Review and confirm the import</li>
              <li>Your items will appear in Square!</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-700 font-semibold mb-1">
                ✅ What's Included:
              </p>
              <p className="text-xs text-blue-900 mb-2">
                • <strong>SKU:</strong> Your card SKU (e.g., OP01-021-NM)
                <br />• <strong>Price:</strong> Sell price
                <br />• <strong>Quantity:</strong> Set in "New Quantity{" "}
                {locationName}" column
              </p>
              <p className="text-xs font-mono text-blue-900 bg-blue-100 p-2 rounded">
                Current Quantity {locationName}
                <br />
                New Quantity {locationName} ← Will be set to item quantity
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading items...</div>
          ) : (
            <div className="mt-6 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Card Name</th>
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Condition</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2">{item.cardName}</td>
                      <td className="p-2">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.sku}
                        </span>
                      </td>
                      <td className="p-2">{item.condition}</td>
                      <td className="p-2 text-right font-semibold">
                        ${item.sellPrice.toFixed(2)}
                      </td>
                      <td className="p-2 text-right">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                          {item.quantity || 1}
                        </span>
                      </td>
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
