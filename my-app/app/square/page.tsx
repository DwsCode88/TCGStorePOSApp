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
  const [items, setItems] = useState<(InventoryItem & { id: string })[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareLocationId, setSquareLocationId] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadSquareSettings();
    loadInventory();
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

      const loadedItems = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          sku: data.sku || doc.id,
        };
      }) as (InventoryItem & { id: string })[];

      setItems(loadedItems);
      toast.success(`Loaded ${loadedItems.length} items`);
    } catch (error: any) {
      console.error("Failed to load:", error);
      toast.error(`Failed to load: ${error.message}`);
      setItems([]);
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

  const syncItemToSquare = async (item: InventoryItem & { id: string }) => {
    console.log(`📤 Syncing: ${item.cardName}, SKU: ${item.sku}`);

    try {
      const response = await fetch("/api/square/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: squareAccessToken,
          locationId: squareLocationId,
          item: {
            sku: item.sku,
            cardName: item.cardName,
            setName: item.setName,
            printing: item.printing,
            condition: item.condition,
            sellPrice: item.sellPrice,
            quantity: item.quantity || 1,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }

      const result = await response.json();

      await updateDoc(doc(db, "inventory", item.id), {
        status: "listed",
        squareItemId: result.squareItemId,
        squareVariationId: result.squareVariationId,
        listedAt: new Date(),
        updatedAt: new Date(),
      });

      setItems(
        items.map((i) =>
          i.sku === item.sku
            ? {
                ...i,
                status: "listed" as const,
                squareItemId: result.squareItemId,
              }
            : i,
        ),
      );

      console.log(`✅ Synced: ${item.cardName}`);
    } catch (error: any) {
      console.error(`❌ Failed to sync ${item.cardName}:`, error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">📦 Square POS Sync</h1>
            <p className="text-gray-600">Upload inventory to Square</p>
          </div>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {showSettings && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Square Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Access Token
                </label>
                <input
                  type="password"
                  value={squareAccessToken}
                  onChange={(e) => setSquareAccessToken(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="EAAxxxxx..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Location ID
                </label>
                <input
                  type="text"
                  value={squareLocationId}
                  onChange={(e) => setSquareLocationId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="L..."
                />
              </div>
              <Button onClick={saveSquareSettings}>Save Settings</Button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <Button
              onClick={loadInventory}
              variant="outline"
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={syncToSquare}
              disabled={syncing || selectedItems.size === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              {syncing
                ? `Syncing ${selectedItems.size}...`
                : `Sync ${selectedItems.size} Selected`}
            </Button>
            <Button onClick={toggleAll} variant="outline">
              {selectedItems.size === items.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                return (
                  <div
                    key={item.sku}
                    onClick={() => toggleItem(item.sku)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold">{item.cardName}</div>
                        <div className="text-sm text-gray-600">
                          {item.setName} • {item.condition} • ${item.sellPrice}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          SKU: {item.sku}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "listed" && item.squareItemId && (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Listed
                          </span>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5"
                        />
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
