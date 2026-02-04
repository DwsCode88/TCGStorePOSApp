"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function ConsignmentPage() {
  const [consignmentItems, setConsignmentItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Map<string, any>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConsignments = async () => {
      try {
        console.log("🔄 Loading customers...");

        // Load all customers first
        let customerMap = new Map();
        try {
          const customersSnapshot = await getDocs(collection(db, "customers"));
          customersSnapshot.docs.forEach((doc) => {
            customerMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
          console.log("✅ Loaded customers:", customerMap.size);
          setCustomers(customerMap);
        } catch (customerError) {
          console.warn(
            "⚠️ Could not load customers (collection may not exist yet):",
            customerError,
          );
          // Continue without customers
        }

        console.log("🔄 Loading consignment items...");

        // Query for all consignment items
        const q = query(
          collection(db, "inventory"),
          where("acquisitionType", "==", "consignment"),
        );

        const querySnapshot = await getDocs(q);
        console.log("✅ Found consignment items:", querySnapshot.size);

        const items = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setConsignmentItems(items);
      } catch (err: any) {
        console.error("❌ Error loading consignments:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadConsignments();
  }, []);

  // Group items by customer
  const itemsByCustomer = consignmentItems.reduce(
    (acc, item) => {
      const customerId = item.customerId || "unknown";
      if (!acc[customerId]) {
        acc[customerId] = [];
      }
      acc[customerId].push(item);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading consignments...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="text-red-800 font-semibold mb-2">
            Error Loading Consignments
          </div>
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Consignment Management
          </h1>
          <p className="text-gray-600">
            Track consignment inventory by customer
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600">
              {consignmentItems.length}
            </div>
            <div className="text-sm text-gray-600">Total Items</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600">
              {Object.keys(itemsByCustomer).length}
            </div>
            <div className="text-sm text-gray-600">Customers</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">
              $
              {consignmentItems
                .reduce((sum, item) => sum + (item.sellPrice || 0), 0)
                .toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
        </div>

        {/* Items by Customer */}
        {consignmentItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <div className="text-xl font-semibold text-gray-800 mb-2">
              No Consignment Items
            </div>
            <div className="text-gray-600">
              Consignment items will appear here after you add them via bulk
              upload.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(itemsByCustomer).map(([customerId, items]) => {
              const customer = customers.get(customerId);
              const totalValue = items.reduce(
                (sum, item) => sum + (item.sellPrice || 0),
                0,
              );
              const payoutPercent = items[0]?.consignorPayoutPercent || 70;
              const consignorPayout = totalValue * (payoutPercent / 100);

              return (
                <div
                  key={customerId}
                  className="bg-white rounded-lg shadow-lg overflow-hidden"
                >
                  {/* Customer Header */}
                  <div className="bg-blue-600 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">
                          {customer?.name || "Unknown Customer"}
                        </h2>
                        {customer?.email && (
                          <div className="text-sm opacity-90 mt-1">
                            {customer.email}
                          </div>
                        )}
                        <div className="text-sm opacity-90 mt-1">
                          Vendor Code: {items[0]?.vendorCode || "N/A"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{items.length}</div>
                        <div className="text-sm opacity-90">Items</div>
                      </div>
                    </div>
                  </div>

                  {/* Payout Info */}
                  <div className="bg-green-50 border-b border-green-200 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-sm text-gray-600">Total Value</div>
                        <div className="text-xl font-bold text-gray-800">
                          ${totalValue.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Payout Rate</div>
                        <div className="text-xl font-bold text-blue-600">
                          {payoutPercent}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">
                          Consignor Payout
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          ${consignorPayout.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-3">Card</th>
                          <th className="text-left p-3">Set</th>
                          <th className="text-left p-3">Condition</th>
                          <th className="text-right p-3">Sell Price</th>
                          <th className="text-right p-3">Payout</th>
                          <th className="text-left p-3">SKU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const itemPayout =
                            (item.sellPrice || 0) * (payoutPercent / 100);
                          return (
                            <tr
                              key={item.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="p-3 font-medium">
                                {item.cardName || item.name}
                              </td>
                              <td className="p-3 text-gray-600">
                                {item.setName || item.set}
                              </td>
                              <td className="p-3 text-gray-600">
                                {item.condition}
                              </td>
                              <td className="p-3 text-right font-semibold text-green-600">
                                ${(item.sellPrice || 0).toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-semibold text-blue-600">
                                ${itemPayout.toFixed(2)}
                              </td>
                              <td className="p-3 text-xs text-gray-500">
                                {item.sku || item.id}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
