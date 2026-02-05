"use client";

import { useState, useEffect } from "react";
import {


  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import {
  Search,
  Edit,
  Trash2,
  CheckSquare,
  Square,
  X,
  Save,
} from "lucide-react";








export const dynamic = 'force-dynamic';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMassEdit, setShowMassEdit] = useState(false);
  const [massEditData, setMassEditData] = useState({
    status: "",
    condition: "",
    printing: "",
    location: "",
  });

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    filterItems();
  }, [searchTerm, items]);

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

  const filterItems = () => {
    if (!searchTerm.trim()) {
      setFilteredItems(items);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = items.filter(
      (item) =>
        item.cardName?.toLowerCase().includes(term) ||
        item.setName?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term) ||
        item.game?.toLowerCase().includes(term),
    );
    setFilteredItems(filtered);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((item) => item.sku)));
    }
  };

  const toggleSelectItem = (sku: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedItems(newSelected);
  };

  const handleMassEdit = async () => {
    if (selectedItems.size === 0) {
      toast.error("No items selected");
      return;
    }

    const updates: any = {};
    if (massEditData.status) updates.status = massEditData.status;
    if (massEditData.condition) updates.condition = massEditData.condition;
    if (massEditData.printing) updates.printing = massEditData.printing;
    if (massEditData.location) updates.location = massEditData.location;

    if (Object.keys(updates).length === 0) {
      toast.error("No fields to update");
      return;
    }

    updates.updatedAt = new Date();

    try {
      console.log(`📝 Mass editing ${selectedItems.size} items...`);

      for (const sku of selectedItems) {
        await updateDoc(doc(db, "inventory", sku), updates);
      }

      toast.success(`Updated ${selectedItems.size} items!`);
      setSelectedItems(new Set());
      setShowMassEdit(false);
      setMassEditData({
        status: "",
        condition: "",
        printing: "",
        location: "",
      });
      await loadInventory();
    } catch (error: any) {
      console.error("Mass edit failed:", error);
      toast.error(`Failed: ${error.message}`);
    }
  };

  const handleMassDelete = async () => {
    if (selectedItems.size === 0) {
      toast.error("No items selected");
      return;
    }

    const confirmed = confirm(
      `Delete ${selectedItems.size} items?\n\nThis cannot be undone!`,
    );

    if (!confirmed) return;

    try {
      console.log(`🗑️ Deleting ${selectedItems.size} items...`);

      for (const sku of selectedItems) {
        await deleteDoc(doc(db, "inventory", sku));
      }

      toast.success(`Deleted ${selectedItems.size} items!`);
      setSelectedItems(new Set());
      await loadInventory();
    } catch (error: any) {
      console.error("Mass delete failed:", error);
      toast.error(`Failed: ${error.message}`);
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
        <h1 className="text-4xl font-bold mb-2">Inventory</h1>
        <p className="text-gray-600 mb-8">Manage your TCG inventory</p>

        {/* Search and Actions */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by card name, set, SKU, or game..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              onClick={toggleSelectAll}
              variant="outline"
              className="flex items-center gap-2"
            >
              {selectedItems.size === filteredItems.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex-1">
                <span className="font-semibold text-blue-900">
                  {selectedItems.size} items selected
                </span>
              </div>
              <Button
                onClick={() => setShowMassEdit(true)}
                variant="outline"
                size="sm"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Mass Edit
              </Button>
              <Button
                onClick={handleMassDelete}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
              <Button
                onClick={() => setSelectedItems(new Set())}
                variant="ghost"
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Mass Edit Modal */}
        {showMassEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  Mass Edit {selectedItems.size} Items
                </h2>
                <Button
                  onClick={() => setShowMassEdit(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Leave fields empty to keep existing values
                </p>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    value={massEditData.status}
                    onChange={(e) =>
                      setMassEditData({
                        ...massEditData,
                        status: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2"
                  >
                    <option value="">-- Keep Existing --</option>
                    <option value="pending">Pending</option>
                    <option value="priced">Priced</option>
                    <option value="labeled">Labeled</option>
                    <option value="listed">Listed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Condition
                  </label>
                  <select
                    value={massEditData.condition}
                    onChange={(e) =>
                      setMassEditData({
                        ...massEditData,
                        condition: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2"
                  >
                    <option value="">-- Keep Existing --</option>
                    <option value="NM">Near Mint (NM)</option>
                    <option value="LP">Lightly Played (LP)</option>
                    <option value="MP">Moderately Played (MP)</option>
                    <option value="HP">Heavily Played (HP)</option>
                    <option value="DMG">Damaged (DMG)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Printing
                  </label>
                  <select
                    value={massEditData.printing}
                    onChange={(e) =>
                      setMassEditData({
                        ...massEditData,
                        printing: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2"
                  >
                    <option value="">-- Keep Existing --</option>
                    <option value="Normal">Normal</option>
                    <option value="Foil">Foil</option>
                    <option value="Holo">Holo</option>
                    <option value="Reverse Holo">Reverse Holo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to keep existing"
                    value={massEditData.location}
                    onChange={(e) =>
                      setMassEditData({
                        ...massEditData,
                        location: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleMassEdit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  onClick={() => setShowMassEdit(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Items</div>
            <div className="text-2xl font-bold">{items.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Showing</div>
            <div className="text-2xl font-bold">{filteredItems.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Selected</div>
            <div className="text-2xl font-bold text-blue-600">
              {selectedItems.size}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Cards</div>
            <div className="text-2xl font-bold">
              {items.reduce((sum, item) => sum + (item.quantity || 1), 0)}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-white rounded-lg shadow">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {searchTerm ? "No items match your search" : "No inventory items"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredItems.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                return (
                  <div
                    key={item.sku}
                    className={`p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer ${
                      isSelected ? "bg-blue-50 border-l-4 border-blue-600" : ""
                    }`}
                    onClick={() => toggleSelectItem(item.sku)}
                  >
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-5 h-5"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">
                          {item.cardName}
                        </h3>
                        {item.quantity && item.quantity > 1 && (
                          <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded font-semibold">
                            ×{item.quantity}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-3">
                          <span>
                            <strong>Set:</strong> {item.setName}
                          </span>
                          <span>
                            <strong>Game:</strong> {item.game}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>
                            <strong>Condition:</strong> {item.condition}
                          </span>
                          <span>
                            <strong>Printing:</strong> {item.printing}
                          </span>
                          {item.location && (
                            <span>
                              <strong>Location:</strong> {item.location}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          SKU: {item.sku}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        ${(item.sellPrice || 0).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Cost: ${(item.costBasis || 0).toFixed(2)}
                      </div>
                      <div className="mt-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            item.status === "listed"
                              ? "bg-green-100 text-green-700"
                              : item.status === "labeled"
                                ? "bg-orange-100 text-orange-700"
                                : item.status === "priced"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.status || "pending"}
                        </span>
                      </div>
                      {item.exportedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          Exported
                        </div>
                      )}
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
