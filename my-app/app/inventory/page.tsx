"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import { Edit2, Trash2, Search, Filter } from "lucide-react";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editPrice, setEditPrice] = useState(0);

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, statusFilter, gameFilter]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const inventoryRef = collection(db, "inventory");
      const snapshot = await getDocs(inventoryRef);

      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];

      setItems(loadedItems);
      toast.success(`Loaded ${loadedItems.length} items`);
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.cardName.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          item.setName.toLowerCase().includes(query),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Game filter
    if (gameFilter !== "all") {
      filtered = filtered.filter((item) => item.game === gameFilter);
    }

    setFilteredItems(filtered);
  };

  const handleEditPrice = (item: InventoryItem) => {
    setEditingItem(item);
    setEditPrice(item.sellPrice || 0);
  };

  const handleSavePrice = async () => {
    if (!editingItem) return;

    try {
      await updateDoc(doc(db, "inventory", editingItem.sku), {
        sellPrice: editPrice,
        updatedAt: new Date(),
      });

      setItems(
        items.map((item) =>
          item.sku === editingItem.sku
            ? { ...item, sellPrice: editPrice }
            : item,
        ),
      );

      toast.success("Price updated!");
      setEditingItem(null);
    } catch (error: any) {
      console.error("Failed to update price:", error);
      toast.error("Failed to update price");
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Delete ${item.cardName}?`)) return;

    try {
      await deleteDoc(doc(db, "inventory", item.sku));
      setItems(items.filter((i) => i.sku !== item.sku));
      toast.success("Item deleted");
    } catch (error: any) {
      console.error("Failed to delete:", error);
      toast.error("Failed to delete item");
    }
  };

  const totalValue = filteredItems.reduce(
    (sum, item) => sum + (item.sellPrice || 0) * (item.quantity || 1),
    0,
  );
  const totalCost = filteredItems.reduce(
    (sum, item) => sum + (item.costBasis || 0) * (item.quantity || 1),
    0,
  );
  const totalProfit = totalValue - totalCost;

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
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Inventory Management</h1>
          <p className="text-gray-600">
            {filteredItems.length} items • ${totalValue.toFixed(2)} value • $
            {totalProfit.toFixed(2)} potential profit
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards, SKU, set..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="priced">Priced</option>
                <option value="labeled">Labeled</option>
                <option value="listed">Listed</option>
              </select>
            </div>

            {/* Game Filter */}
            <div>
              <select
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Games</option>
                <option value="pokemon">Pokémon</option>
                <option value="mtg">Magic: The Gathering</option>
                <option value="onepiece">One Piece</option>
                <option value="lorcana">Lorcana</option>
                <option value="digimon">Digimon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Total Items</div>
            <div className="text-2xl font-bold">{filteredItems.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Total Value</div>
            <div className="text-2xl font-bold text-green-600">
              ${totalValue.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Total Cost</div>
            <div className="text-2xl font-bold text-red-600">
              ${totalCost.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600">Potential Profit</div>
            <div className="text-2xl font-bold text-blue-600">
              ${totalProfit.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Game
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No items found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {item.cardName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.setName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                        {item.game}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {item.condition}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.quantity || 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        ${(item.costBasis || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {editingItem?.sku === item.sku ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) =>
                              setEditPrice(parseFloat(e.target.value))
                            }
                            className="w-20 px-2 py-1 border rounded text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-semibold text-green-600">
                            ${(item.sellPrice || 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                        $
                        {(
                          ((item.sellPrice || 0) - (item.costBasis || 0)) *
                          (item.quantity || 1)
                        ).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "listed"
                              ? "bg-green-100 text-green-800"
                              : item.status === "labeled"
                                ? "bg-blue-100 text-blue-800"
                                : item.status === "priced"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status || "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {editingItem?.sku === item.sku ? (
                            <>
                              <button
                                onClick={handleSavePrice}
                                className="text-green-600 hover:text-green-800"
                                title="Save"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="text-gray-600 hover:text-gray-800"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditPrice(item)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit Price"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 flex justify-center">
          <Button onClick={loadInventory} disabled={loading} size="lg">
            {loading ? "Refreshing..." : "Refresh Inventory"}
          </Button>
        </div>
      </div>
    </div>
  );
}
