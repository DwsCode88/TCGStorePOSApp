"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";

interface PriceIncrease {
  id: string;
  sku: string;
  cardName: string;
  setName: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  percentChange: number;
  lastUpdated: string;
  needsRelabel: boolean;
  location: string;
}

export default function PriceIncreaseDashboard() {
  const [increases, setIncreases] = useState<PriceIncrease[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "relabeled">(
    "pending",
  );
  const [minIncrease, setMinIncrease] = useState(0.5); // Minimum $0.50 increase

  useEffect(() => {
    loadPriceIncreases();
  }, []);

  const loadPriceIncreases = async () => {
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Filter items with price history showing increases
      const withIncreases = items
        .filter((item) => {
          const history = item.priceHistory || [];
          if (history.length === 0) return false;

          const lastChange = history[history.length - 1];
          return lastChange.changeAmount > minIncrease; // Only increases above threshold
        })
        .map((item) => {
          const history = item.priceHistory || [];
          const lastChange = history[history.length - 1];

          return {
            id: item.id,
            sku: item.sku,
            cardName: item.cardName || item.name,
            setName: item.setName || item.set,
            oldPrice: lastChange.oldPrice,
            newPrice: lastChange.newPrice,
            change: lastChange.changeAmount,
            percentChange: lastChange.changePercent,
            lastUpdated: lastChange.updatedAt,
            needsRelabel: !item.relabeled,
            location: item.displayLocation || item.location || "Unknown",
          };
        })
        .sort((a, b) => b.change - a.change); // Sort by highest increase

      setIncreases(withIncreases);
    } catch (error) {
      console.error("Error loading price increases:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRelabeled = async (id: string) => {
    try {
      await updateDoc(doc(db, "inventory", id), {
        relabeled: true,
        relabeledAt: new Date().toISOString(),
      });

      // Update local state
      setIncreases(
        increases.map((item) =>
          item.id === id ? { ...item, needsRelabel: false } : item,
        ),
      );
    } catch (error) {
      console.error("Error marking as relabeled:", error);
    }
  };

  const filteredIncreases = increases.filter((item) => {
    if (filter === "pending") return item.needsRelabel;
    if (filter === "relabeled") return !item.needsRelabel;
    return true;
  });

  const totalValue = filteredIncreases.reduce(
    (sum, item) => sum + item.change,
    0,
  );
  const pendingCount = increases.filter((i) => i.needsRelabel).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">
            Loading price increases...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Price Increase Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Cards that increased in value - Need new price stickers
              </p>
            </div>
            <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold">
              🧪 BETA
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-green-700">
                {increases.length}
              </div>
              <div className="text-sm text-gray-600">Total Increases</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-orange-700">
                {pendingCount}
              </div>
              <div className="text-sm text-gray-600">Need Relabeling</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-blue-700">
                ${totalValue.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total Value Increase</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-purple-700">
                ${(totalValue / increases.length).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Avg Increase</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                All ({increases.length})
              </button>
              <button
                onClick={() => setFilter("pending")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "pending"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setFilter("relabeled")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "relabeled"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Relabeled ({increases.length - pendingCount})
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm text-gray-600">Min Increase:</label>
              <select
                value={minIncrease}
                onChange={(e) => setMinIncrease(parseFloat(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2"
              >
                <option value="0.25">$0.25+</option>
                <option value="0.50">$0.50+</option>
                <option value="1.00">$1.00+</option>
                <option value="2.00">$2.00+</option>
                <option value="5.00">$5.00+</option>
              </select>
              <button
                onClick={loadPriceIncreases}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg font-semibold"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Cards List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {filteredIncreases.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <div className="text-xl font-semibold mb-2">
                No price increases found
              </div>
              <div className="text-sm">
                Run weekly repricing to check for price changes
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-4">Card</th>
                    <th className="text-left p-4">Location</th>
                    <th className="text-right p-4">Old Price</th>
                    <th className="text-right p-4">New Price</th>
                    <th className="text-right p-4">Increase</th>
                    <th className="text-right p-4">%</th>
                    <th className="text-center p-4">Status</th>
                    <th className="text-center p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncreases.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b hover:bg-gray-50 ${
                        item.needsRelabel ? "bg-orange-50" : "bg-green-50"
                      }`}
                    >
                      <td className="p-4">
                        <div className="font-semibold">{item.cardName}</div>
                        <div className="text-sm text-gray-600">
                          {item.setName}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {item.sku}
                        </div>
                      </td>
                      <td className="p-4 text-sm">{item.location}</td>
                      <td className="p-4 text-right text-gray-600">
                        ${item.oldPrice.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-bold text-green-600">
                        ${item.newPrice.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-bold text-green-600">
                        +${item.change.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-bold text-green-600">
                        +{item.percentChange.toFixed(1)}%
                      </td>
                      <td className="p-4 text-center">
                        {item.needsRelabel ? (
                          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Needs Label
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                            ✓ Relabeled
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {item.needsRelabel && (
                          <button
                            onClick={() => markAsRelabeled(item.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                          >
                            Mark Relabeled
                          </button>
                        )}
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
