"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import {
  Upload,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
} from "lucide-react";

export default function SquareSyncPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareLocationId, setSquareLocationId] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadInventory();
    loadSquareSettings();
  }, []);

  const loadSquareSettings = () => {
    const token = localStorage.getItem("squareAccessToken");
    const location = localStorage.getItem("squareLocationId");
    if (token) setSquareAccessToken(token);
    if (location) setSquareLocationId(location);
  };

  const saveSquareSettings = () => {
    localStorage.setItem("squareAccessToken", squareAccessToken);
    localStorage.setItem("squareLocationId", squareLocationId);
    toast.success("Square settings saved!");
    setShowSettings(false);
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];

      // Filter to labeled items (ready to list)
      const labeled = loadedItems.filter((item) => item.status === "labeled");
      setItems(labeled);
      toast.success(`Loaded ${labeled.length} items ready to sync`);
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
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

  const syncToSquare = async () => {
    if (!squareAccessToken || !squareLocationId) {
      toast.error("Please configure Square settings first");
      setShowSettings(true);
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setSyncing(true);
    const itemsToSync = items.filter((item) => selectedItems.has(item.sku));

    console.log("🔄 Syncing to Square:", itemsToSync.length, "items");

    try {
      for (const item of itemsToSync) {
        await syncItemToSquare(item);
      }

      toast.success(
        `Successfully synced ${itemsToSync.length} items to Square!`,
      );
      setSelectedItems(new Set());
      loadInventory();
    } catch (error: any) {
      console.error("Sync failed:", error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const syncItemToSquare = async (item: InventoryItem) => {
    console.log(`📤 Syncing: ${item.cardName}`);

    // Create Square catalog object
    const catalogObject = {
      type: "ITEM",
      id: `#${item.sku}`,
      item_data: {
        name: item.cardName,
        description: `${item.setName} - ${item.printing || "Normal"} - ${item.condition}`,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: `#${item.sku}-variation`,
            item_variation_data: {
              item_id: `#${item.sku}`,
              name: item.condition,
              pricing_type: "FIXED_PRICING",
              price_money: {
                amount: Math.round((item.sellPrice || 0) * 100), // Convert to cents
                currency: "USD",
              },
              sku: item.sku,
            },
          },
        ],
        product_type: "REGULAR",
        skip_modifier_screen: false,
      },
    };

    // Call Square API
    const response = await fetch(
      "https://connect.squareup.com/v2/catalog/object",
      {
        method: "POST",
        headers: {
          "Square-Version": "2024-01-18",
          Authorization: `Bearer ${squareAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: item.sku,
          object: catalogObject,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Square API error:", error);
      throw new Error(error.errors?.[0]?.detail || "Square API error");
    }

    const result = await response.json();
    console.log("✅ Synced:", item.cardName, "→", result.catalog_object.id);

    // Update Firebase with Square ID
    await updateDoc(doc(db, "inventory", item.sku), {
      status: "listed",
      squareItemId: result.catalog_object.id,
      squareVariationId: result.catalog_object.item_data.variations[0].id,
      listedAt: new Date(),
      updatedAt: new Date(),
    });

    // Update local state
    setItems(
      items.map((i) =>
        i.sku === item.sku
          ? {
              ...i,
              status: "listed" as const,
              squareItemId: result.catalog_object.id,
            }
          : i,
      ),
    );
  };

  const allSelected = items.length > 0 && selectedItems.size === items.length;

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
            <h1 className="text-4xl font-bold mb-2">Square POS Sync</h1>
            <p className="text-gray-600">
              Push labeled items to Square catalog
            </p>
          </div>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
          >
            <Settings className="w-4 h-4 mr-2" />
            Square Settings
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Square API Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Square Access Token
                  <a
                    href="https://developer.squareup.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-xs ml-2 hover:underline"
                  >
                    Get from Square Developer Dashboard →
                  </a>
                </label>
                <input
                  type="password"
                  value={squareAccessToken}
                  onChange={(e) => setSquareAccessToken(e.target.value)}
                  placeholder="EAAAl..."
                  className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Square Location ID
                  <span className="text-xs text-gray-600 ml-2">
                    (Your store location)
                  </span>
                </label>
                <input
                  type="text"
                  value={squareLocationId}
                  onChange={(e) => setSquareLocationId(e.target.value)}
                  placeholder="L..."
                  className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSquareSettings} className="bg-green-600">
                  Save Settings
                </Button>
                <Button
                  onClick={() => setShowSettings(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Status Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-900">
                {selectedItems.size} items selected
              </div>
              <div className="text-sm text-blue-700">
                {items.length} items ready to sync
              </div>
            </div>
            {squareAccessToken && squareLocationId ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Square Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Square Not Configured
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex gap-3">
            <Button onClick={toggleAll} variant="outline" className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            <Button
              onClick={loadInventory}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={syncToSquare}
              disabled={
                selectedItems.size === 0 || syncing || !squareAccessToken
              }
              className="flex-1 bg-blue-600"
              size="lg"
            >
              <Upload className="w-4 h-4 mr-2" />
              {syncing ? "Syncing..." : `Sync ${selectedItems.size} to Square`}
            </Button>
          </div>
        </div>

        {/* Items Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">
            Items Ready to Sync ({items.length})
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-2">No items ready to sync</p>
              <p className="text-sm">
                Items must be "labeled" status to appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                return (
                  <div
                    key={item.sku}
                    onClick={() => toggleItem(item.sku)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          {item.cardName}
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          {item.setName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.printing} • {item.condition}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isSelected ? (
                          <CheckCircle className="w-6 h-6 text-blue-600" />
                        ) : (
                          <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="text-lg font-bold text-green-600">
                        ${(item.sellPrice || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {item.sku}
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
