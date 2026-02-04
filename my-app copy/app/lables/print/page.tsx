"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  sku?: string;
  cardName: string;
  setName: string;
  condition: string;
  sellPrice: number;
  acquisitionType?: string;
  customerVendorCode?: string;
  vendorCode?: string;
  labelPrinted?: boolean;
  labelPrintedAt?: string;
  labelPrintCount?: number;
  game?: string;
  number?: string;
}

export default function LabelsPage() {
  const [needToPrint, setNeedToPrint] = useState<InventoryItem[]>([]);
  const [previouslyPrinted, setPreviouslyPrinted] = useState<InventoryItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [vendorCode, setVendorCode] = useState("");
  const [showVendorSetup, setShowVendorSetup] = useState(false);

  useEffect(() => {
    loadVendorCode();
    loadItems();
  }, []);

  const loadVendorCode = () => {
    const saved = localStorage.getItem("storeVendorCode");
    if (saved) {
      setVendorCode(saved);
    } else {
      setShowVendorSetup(true);
    }
  };

  const saveVendorCode = () => {
    if (vendorCode.trim()) {
      localStorage.setItem("storeVendorCode", vendorCode.toUpperCase());
      setShowVendorSetup(false);
      toast.success("Vendor code saved!");
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "inventory"));
      const allItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as InventoryItem[];

      console.log("📦 Loaded items:", allItems.length);
      console.log("🔍 Sample item:", allItems[0]);

      const needPrint = allItems.filter((item) => !item.labelPrinted);
      const printed = allItems
        .filter((item) => item.labelPrinted)
        .sort((a, b) =>
          (b.labelPrintedAt || "").localeCompare(a.labelPrintedAt || ""),
        );

      console.log("📋 Need to print:", needPrint.length);
      console.log("✅ Already printed:", printed.length);

      // Log consignment items specifically
      const consignments = allItems.filter(
        (item) => item.acquisitionType === "consignment",
      );
      console.log("🤝 Consignment items:", consignments.length);
      if (consignments.length > 0) {
        console.log("🔍 Sample consignment:", {
          id: consignments[0].id,
          sku: consignments[0].sku,
          acquisitionType: consignments[0].acquisitionType,
          customerVendorCode: consignments[0].customerVendorCode,
        });
      }

      setNeedToPrint(needPrint);
      setPreviouslyPrinted(printed);
    } catch (error) {
      console.error("Error loading items:", error);
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const generateBarcodeValue = (item: InventoryItem) => {
    let barcode = "";

    // Priority 1: If item has a custom SKU field, use it
    if (item.sku) {
      barcode = item.sku;
      console.log(`🏷️ Using SKU field for ${item.cardName}:`, barcode);
      return barcode;
    }

    // Priority 2: For consignment items, the document ID itself is the custom SKU
    if (item.acquisitionType === "consignment") {
      barcode = item.id; // Document ID is the custom SKU for consignments
      console.log(
        `🤝 Consignment - using document ID as barcode for ${item.cardName}:`,
        barcode,
      );
      return barcode;
    }

    // Priority 3: For non-consignment, use store vendor code + ID
    barcode = vendorCode ? `${vendorCode}-${item.id}` : item.id;
    console.log(`🏪 Store barcode for ${item.cardName}:`, barcode);
    return barcode;
  };

  const markAsPrinted = async (itemIds: string[]) => {
    try {
      for (const itemId of itemIds) {
        const item = needToPrint.find((i) => i.id === itemId);
        const updateData: any = {
          labelPrinted: true,
          labelPrintedAt: new Date().toISOString(),
          labelPrintCount: 1,
        };

        // Only save store vendor code if not a consignment item
        // (consignment items already have customerVendorCode)
        if (item?.acquisitionType !== "consignment") {
          updateData.vendorCode = vendorCode || null;
        }

        await updateDoc(doc(db, "inventory", itemId), updateData);
      }

      toast.success(`Marked ${itemIds.length} item(s) as printed`);
      setSelectedItems(new Set());
      loadItems();
    } catch (error) {
      console.error("Error marking as printed:", error);
      toast.error("Failed to mark as printed");
    }
  };

  const reprintLabel = async (item: InventoryItem) => {
    // Open print window for single item
    printLabels([item], true);

    // Update print count
    try {
      const newCount = (item.labelPrintCount || 0) + 1;
      await updateDoc(doc(db, "inventory", item.id), {
        labelPrintedAt: new Date().toISOString(),
        labelPrintCount: newCount,
      });
      loadItems();
    } catch (error) {
      console.error("Error updating reprint:", error);
    }
  };

  const moveToNeedPrint = async (itemId: string) => {
    try {
      await updateDoc(doc(db, "inventory", itemId), {
        labelPrinted: false,
        labelPrintedAt: null,
      });

      toast.success("Moved back to print queue");
      loadItems();
    } catch (error) {
      console.error("Error moving to queue:", error);
      toast.error("Failed to move to queue");
    }
  };

  const toggleSelect = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(needToPrint.map((item) => item.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const printLabels = (items: InventoryItem[], isReprint = false) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Pop-up blocked! Please allow pop-ups.");
      return;
    }

    const labelsHTML = items
      .map((item) => {
        const barcode = generateBarcodeValue(item);
        return `
        <div class="label">
          <div class="card-name">${item.cardName}</div>
          <div class="set-info">${item.setName} #${item.number || "N/A"}</div>
          <div class="condition-price">
            <span class="condition">${item.condition}</span>
            <span class="price">$${item.sellPrice.toFixed(2)}</span>
          </div>
          <div class="barcode-container">
            <svg class="barcode"></svg>
            <div class="barcode-text">${barcode}</div>
          </div>
        </div>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          .label {
            width: 2.5in;
            height: 1.25in;
            border: 1px solid #000;
            padding: 6px;
            margin: 4px;
            display: inline-block;
            page-break-inside: avoid;
          }
          .card-name {
            font-size: 11pt;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
          }
          .set-info {
            font-size: 8pt;
            color: #666;
            margin-bottom: 3px;
          }
          .condition-price {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .condition {
            font-size: 8pt;
            font-weight: bold;
          }
          .price {
            font-size: 14pt;
            font-weight: bold;
          }
          .barcode-container {
            text-align: center;
          }
          .barcode {
            height: 30px;
          }
          .barcode-text {
            font-size: 7pt;
            margin-top: 2px;
            font-family: monospace;
          }
          @media print {
            body { padding: 0; }
            .label { 
              border: 1px solid #000;
              margin: 2px;
            }
          }
        </style>
      </head>
      <body>
        ${labelsHTML}
        <script>
          const barcodes = document.querySelectorAll('.barcode');
          const barcodeTexts = document.querySelectorAll('.barcode-text');
          
          barcodes.forEach((barcode, index) => {
            const code = barcodeTexts[index].textContent;
            JsBarcode(barcode, code, {
              format: 'CODE128',
              width: 1.5,
              height: 30,
              displayValue: false,
              margin: 0
            });
          });
          
          setTimeout(() => {
            window.print();
            ${!isReprint ? "window.close();" : ""}
          }, 500);
        </script>
      </body>
      </html>
    `);
  };

  const printSelected = () => {
    const itemsToPrint = needToPrint.filter((item) =>
      selectedItems.has(item.id),
    );
    printLabels(itemsToPrint);

    setTimeout(() => {
      if (confirm("Mark selected items as printed?")) {
        markAsPrinted(Array.from(selectedItems));
      }
    }, 1000);
  };

  if (loading) {
    return <div className="p-8">Loading labels...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">🏷️ Print Labels</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div className="text-gray-600">Vendor Code:</div>
              <div className="font-mono font-bold">
                {vendorCode || "Not Set"}
              </div>
            </div>
            <Button
              onClick={() => setShowVendorSetup(true)}
              variant="outline"
              size="sm"
            >
              Change Code
            </Button>
          </div>
        </div>

        {/* Vendor Code Setup Modal */}
        {showVendorSetup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Set Vendor Code</h2>
              <p className="text-gray-600 mb-4">
                This code will be included in all barcodes (e.g., STORE-12345)
              </p>
              <input
                type="text"
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g., STORE)"
                className="w-full px-4 py-2 border rounded-lg mb-4 font-mono text-lg"
                maxLength={10}
              />
              <div className="flex gap-3">
                <Button
                  onClick={saveVendorCode}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Save
                </Button>
                {vendorCode && (
                  <Button
                    onClick={() => setShowVendorSetup(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Need to Print Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b bg-blue-50">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                📋 Need to Print ({needToPrint.length})
              </h2>
              <div className="flex gap-2">
                <Button onClick={selectAll} variant="outline" size="sm">
                  Select All
                </Button>
                <Button onClick={deselectAll} variant="outline" size="sm">
                  Deselect All
                </Button>
                {selectedItems.size > 0 && (
                  <>
                    <Button
                      onClick={printSelected}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      Print Selected ({selectedItems.size})
                    </Button>
                    <Button
                      onClick={() => markAsPrinted(Array.from(selectedItems))}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      Mark as Printed
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4">
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.size === needToPrint.length &&
                        needToPrint.length > 0
                      }
                      onChange={(e) =>
                        e.target.checked ? selectAll() : deselectAll()
                      }
                    />
                  </th>
                  <th className="text-left p-4 font-semibold">Card</th>
                  <th className="text-left p-4 font-semibold">Condition</th>
                  <th className="text-right p-4 font-semibold">Price</th>
                  <th className="text-left p-4 font-semibold">Barcode</th>
                </tr>
              </thead>
              <tbody>
                {needToPrint.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t hover:bg-gray-50 ${selectedItems.has(item.id) ? "bg-blue-50" : ""}`}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-semibold">{item.cardName}</div>
                      <div className="text-sm text-gray-500">
                        {item.setName}
                      </div>
                    </td>
                    <td className="p-4">{item.condition}</td>
                    <td className="p-4 text-right font-bold">
                      ${item.sellPrice.toFixed(2)}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {generateBarcodeValue(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {needToPrint.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                <div>All labels printed!</div>
              </div>
            )}
          </div>
        </div>

        {/* Previously Printed Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b bg-gray-50">
            <h2 className="text-2xl font-semibold">
              📦 Previously Printed ({previouslyPrinted.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Click Reprint to print again, or Move to Queue to reprint later
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-semibold">Card</th>
                  <th className="text-left p-4 font-semibold">Barcode</th>
                  <th className="text-right p-4 font-semibold">Price</th>
                  <th className="text-center p-4 font-semibold">
                    Times Printed
                  </th>
                  <th className="text-center p-4 font-semibold">
                    Last Printed
                  </th>
                  <th className="text-center p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {previouslyPrinted.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold">{item.cardName}</div>
                      <div className="text-sm text-gray-500">
                        {item.setName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {item.condition}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {generateBarcodeValue(item)}
                    </td>
                    <td className="p-4 text-right font-bold">
                      ${item.sellPrice.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {item.labelPrintCount || 1}x
                      </span>
                    </td>
                    <td className="p-4 text-center text-sm">
                      {item.labelPrintedAt
                        ? new Date(item.labelPrintedAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => reprintLabel(item)}
                          variant="outline"
                          size="sm"
                        >
                          Reprint
                        </Button>
                        <Button
                          onClick={() => moveToNeedPrint(item.id)}
                          variant="outline"
                          size="sm"
                          className="text-orange-600"
                        >
                          Move to Queue
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previouslyPrinted.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                No labels printed yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
