"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";

export default function DebugInventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const allItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setItems(allItems);
      console.log("📦 All inventory items:", allItems);
    } catch (error) {
      console.error("Error loading:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const consignmentItems = items.filter(
    (item) => item.acquisitionType === "consignment",
  );
  const regularItems = items.filter(
    (item) => item.acquisitionType !== "consignment",
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🔍 Debug Inventory Data</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold">
                {consignmentItems.length}
              </div>
              <div className="text-sm text-gray-600">Consignments</div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <div className="text-2xl font-bold">{regularItems.length}</div>
              <div className="text-sm text-gray-600">Regular Items</div>
            </div>
          </div>
        </div>

        {/* Consignment Items */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b bg-green-50">
            <h2 className="text-2xl font-semibold">🤝 Consignment Items</h2>
            <p className="text-sm text-gray-600 mt-1">
              These should have customerVendorCode and custom SKU
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Card</th>
                  <th className="text-left p-3 font-semibold">ID</th>
                  <th className="text-left p-3 font-semibold">SKU</th>
                  <th className="text-left p-3 font-semibold">Acq Type</th>
                  <th className="text-left p-3 font-semibold">
                    Customer Vendor Code
                  </th>
                  <th className="text-left p-3 font-semibold">Customer ID</th>
                </tr>
              </thead>
              <tbody>
                {consignmentItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      <div className="font-semibold">{item.cardName}</div>
                      <div className="text-xs text-gray-500">
                        {item.setName}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{item.id}</td>
                    <td className="p-3">
                      {item.sku ? (
                        <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">
                          {item.sku}
                        </span>
                      ) : (
                        <span className="text-red-500 text-xs">❌ No SKU</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {item.acquisitionType || "?"}
                    </td>
                    <td className="p-3">
                      {item.customerVendorCode ? (
                        <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">
                          {item.customerVendorCode}
                        </span>
                      ) : (
                        <span className="text-orange-500 text-xs">⚠️ None</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {item.customerId || "?"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {consignmentItems.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                No consignment items
              </div>
            )}
          </div>
        </div>

        {/* Regular Items */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b bg-purple-50">
            <h2 className="text-2xl font-semibold">🏪 Regular Items</h2>
            <p className="text-sm text-gray-600 mt-1">
              These should have vendorCode (added when printed)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Card</th>
                  <th className="text-left p-3 font-semibold">ID</th>
                  <th className="text-left p-3 font-semibold">SKU</th>
                  <th className="text-left p-3 font-semibold">Acq Type</th>
                  <th className="text-left p-3 font-semibold">Vendor Code</th>
                  <th className="text-left p-3 font-semibold">Label Printed</th>
                </tr>
              </thead>
              <tbody>
                {regularItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      <div className="font-semibold">{item.cardName}</div>
                      <div className="text-xs text-gray-500">
                        {item.setName}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{item.id}</td>
                    <td className="p-3">
                      {item.sku ? (
                        <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">
                          {item.sku}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {item.acquisitionType || "?"}
                    </td>
                    <td className="p-3">
                      {item.vendorCode ? (
                        <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">
                          {item.vendorCode}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {item.labelPrinted ? (
                        <span className="text-green-600 text-xs">✓ Yes</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {regularItems.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                No regular items
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-2">🔍 What to Look For:</h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>✅ Good Consignment Item:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>
                  Has <code className="bg-gray-100 px-1">sku</code>: Something
                  like <code className="bg-green-100 px-1">JOHN-M4K2L9ABC</code>
                </li>
                <li>
                  Has <code className="bg-gray-100 px-1">acquisitionType</code>:{" "}
                  <code className="bg-green-100 px-1">consignment</code>
                </li>
                <li>
                  Has{" "}
                  <code className="bg-gray-100 px-1">customerVendorCode</code>:
                  Customer's code like{" "}
                  <code className="bg-green-100 px-1">JOHN</code>
                </li>
                <li>
                  Has <code className="bg-gray-100 px-1">customerId</code>:
                  Firebase ID of customer
                </li>
              </ul>
            </div>
            <div className="mt-4">
              <strong>⚠️ Problem Consignment Item:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>
                  <span className="text-red-600">❌ No SKU</span> - Custom SKU
                  wasn't generated
                </li>
                <li>
                  <span className="text-orange-600">
                    ⚠️ No customerVendorCode
                  </span>{" "}
                  - Customer didn't have vendor code when item was added
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
            🔄 Reload Data
          </Button>
          <Button
            onClick={() => {
              console.log("📦 Full data dump:", items);
              alert("Check browser console for full data");
            }}
            variant="outline"
          >
            📋 Log to Console
          </Button>
        </div>
      </div>
    </div>
  );
}
