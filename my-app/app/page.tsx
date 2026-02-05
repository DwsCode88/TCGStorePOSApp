"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import {


  Package,
  Upload,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  BarChart3,
  Settings,
  Printer,
  ShoppingCart,
  FileDown,
  History,
  Archive,
} from "lucide-react";
import Link from "next/link";

interface ExportBatch {
  id: string;
  batchNumber: string;
  exportedAt: Date;
  itemCount: number;
  totalCards: number;
  totalValue: number;
  filename: string;
}

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<ExportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareLocationId, setSquareLocationId] = useState("");

  useEffect(() => {
    loadInventory();
    loadSquareSettings();
    loadBatches();
  }, []);

  const loadSquareSettings = () => {
    const token = localStorage.getItem("squareAccessToken");
    const location = localStorage.getItem("squareLocationId");
    if (token) setSquareAccessToken(token);
    if (location) setSquareLocationId(location);
  };

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

  const loadBatches = async () => {
    try {
      const snapshot = await getDocs(collection(db, "exportBatches"));
      const loadedBatches = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        exportedAt: doc.data().exportedAt?.toDate() || new Date(),
      })) as ExportBatch[];

      loadedBatches.sort(
        (a, b) => b.exportedAt.getTime() - a.exportedAt.getTime(),
      );
      setBatches(loadedBatches.slice(0, 5)); // Only show 5 most recent
    } catch (error: any) {
      console.error("Failed to load batches:", error);
    }
  };

  const quickSyncToSquare = async () => {
    if (!squareAccessToken || !squareLocationId) {
      toast.error("Square not configured. Go to Square page to set up.");
      return;
    }

    const labeledItems = items.filter((item) => item.status === "labeled");

    if (labeledItems.length === 0) {
      toast.error("No labeled items to sync. Print labels first!");
      return;
    }

    setSyncing(true);
    const totalCards = labeledItems.reduce(
      (sum, i) => sum + (i.quantity || 1),
      0,
    );
    console.log(
      `🔄 Quick syncing ${labeledItems.length} labeled items (${totalCards} total cards) to Square`,
    );

    try {
      let successCount = 0;
      let failCount = 0;
      let totalCardsSync = 0;

      for (const item of labeledItems) {
        try {
          const response = await fetch("/api/square/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
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

          if (response.ok) {
            await updateDoc(doc(db, "inventory", item.sku), {
              status: "listed",
              updatedAt: new Date(),
            });
            successCount++;
            totalCardsSync += item.quantity || 1;
            console.log(
              `✅ Synced: ${item.cardName} (${item.quantity || 1} cards)`,
            );
          } else {
            failCount++;
            console.error(`❌ Failed: ${item.cardName}`);
          }
        } catch (err) {
          failCount++;
          console.error(`❌ Error syncing ${item.cardName}:`, err);
        }
      }

      if (successCount > 0) {
        toast.success(
          `✅ Synced ${totalCardsSync} cards (${successCount} items) to Square!`,
        );
      }
      if (failCount > 0) {
        toast.error(`❌ Failed to sync ${failCount} items`);
      }

      await loadInventory();
    } catch (error: any) {
      console.error("Sync failed:", error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Calculate stats
  const totalItems = items.length;
  const totalCards = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalValue = items.reduce(
    (sum, item) => sum + (item.sellPrice || 0) * (item.quantity || 1),
    0,
  );
  const totalCost = items.reduce(
    (sum, item) => sum + (item.costBasis || 0) * (item.quantity || 1),
    0,
  );
  const potentialProfit = totalValue - totalCost;
  const profitMargin =
    totalValue > 0 ? (potentialProfit / totalValue) * 100 : 0;

  // Status counts (cards, not items)
  const pendingCards = items
    .filter((i) => i.status === "pending")
    .reduce((sum, item) => sum + (item.quantity || 1), 0);
  const pricedCards = items
    .filter((i) => i.status === "priced")
    .reduce((sum, item) => sum + (item.quantity || 1), 0);
  const labeledCards = items
    .filter((i) => i.status === "labeled")
    .reduce((sum, item) => sum + (item.quantity || 1), 0);
  const listedCards = items
    .filter((i) => i.status === "listed")
    .reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Export stats
  const notExportedItems = items.filter((i) => !i.exportedAt).length;
  const notExportedCards = items
    .filter((i) => !i.exportedAt)
    .reduce((sum, item) => sum + (item.quantity || 1), 0);
  const exportedItems = items.filter((i) => i.exportedAt).length;
  const totalBatches = batches.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg font-medium">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">VaultTrove Dashboard</h1>
          <p className="text-gray-600">Manage your TCG inventory</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-blue-600" />
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-3xl font-bold mb-1">{totalCards}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
            <div className="text-xs text-gray-500 mt-1">{totalItems} items</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold mb-1">
              ${totalValue.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
            <div className="text-xs text-gray-500 mt-1">
              Cost: ${totalCost.toFixed(2)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <div className="text-xs font-semibold text-purple-600">
                {profitMargin.toFixed(1)}%
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              ${potentialProfit.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Potential Profit</div>
            <div className="text-xs text-gray-500 mt-1">Margin</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-orange-600" />
              <ShoppingCart className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-3xl font-bold mb-1">{labeledCards}</div>
            <div className="text-sm text-gray-600">Ready to Sync</div>
            <div className="text-xs text-gray-500 mt-1">
              {items.filter((i) => i.status === "labeled").length} items
            </div>
          </div>
        </div>

        {/* Square Sync Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Square POS Sync</h2>
              <p className="text-blue-100 mb-4">
                {labeledCards > 0
                  ? `${labeledCards} cards (${items.filter((i) => i.status === "labeled").length} items) ready to sync`
                  : "No items ready. Print labels first!"}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={quickSyncToSquare}
                  disabled={syncing || labeledCards === 0 || !squareAccessToken}
                  className="bg-white text-blue-600 hover:bg-blue-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {syncing ? "Syncing..." : `Sync ${labeledCards} Cards`}
                </Button>
                <Link href="/square">
                  <Button
                    variant="outline"
                    className="border-white text-white hover:bg-blue-600"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configure Square
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-sm text-blue-100 mb-2">
                Connection Status
              </div>
              <div
                className={`text-lg font-semibold ${squareAccessToken ? "text-green-300" : "text-yellow-300"}`}
              >
                {squareAccessToken ? "✓ Connected" : "! Not Configured"}
              </div>
              <div className="text-xs text-blue-200 mt-1">
                {listedCards} cards already in Square
              </div>
            </div>
          </div>
        </div>

        {/* CSV Export Section */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">CSV Export to POS</h2>
              <p className="text-green-100 mb-4">
                {notExportedCards > 0
                  ? `${notExportedCards} cards (${notExportedItems} items) ready to export`
                  : "All items exported!"}
              </p>
              <div className="flex gap-3">
                <Link href="/export">
                  <Button className="bg-white text-green-600 hover:bg-green-50">
                    <FileDown className="w-4 h-4 mr-2" />
                    {notExportedCards > 0
                      ? `Export ${notExportedCards} Cards`
                      : "Go to Export"}
                  </Button>
                </Link>
                {totalBatches > 0 && (
                  <Link href="/export">
                    <Button
                      variant="outline"
                      className="border-white text-white hover:bg-green-600"
                    >
                      <History className="w-4 h-4 mr-2" />
                      View {totalBatches} Batches
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-sm text-green-100 mb-2">Export Status</div>
              <div className="text-lg font-semibold text-green-300">
                {exportedItems} / {totalItems} Items
              </div>
              <div className="text-xs text-green-200 mt-1">
                {totalBatches} batches in history
              </div>
            </div>
          </div>
        </div>

        {/* Recent Export Batches */}
        {batches.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Export Batches</h2>
              <Link href="/export">
                <Button variant="outline" size="sm">
                  <Archive className="w-4 h-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="border rounded p-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <div className="font-semibold text-sm">
                      {batch.batchNumber}
                    </div>
                    <div className="text-xs text-gray-600">
                      {batch.exportedAt.toLocaleDateString()} •{" "}
                      {batch.itemCount} items • {batch.totalCards} cards
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      ${batch.totalValue.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">value</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory Pipeline */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Inventory Pipeline</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div className="font-semibold text-yellow-900">Pending</div>
              </div>
              <div className="text-3xl font-bold text-yellow-600 mb-1">
                {pendingCards}
              </div>
              <div className="text-xs text-yellow-700">
                {items.filter((i) => i.status === "pending").length} items
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <div className="font-semibold text-blue-900">Priced</div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {pricedCards}
              </div>
              <div className="text-xs text-blue-700">
                {items.filter((i) => i.status === "priced").length} items
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <Printer className="w-5 h-5 text-orange-600" />
                <div className="font-semibold text-orange-900">Labeled</div>
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-1">
                {labeledCards}
              </div>
              <div className="text-xs text-orange-700">
                {items.filter((i) => i.status === "labeled").length} items
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="font-semibold text-green-900">Listed</div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {listedCards}
              </div>
              <div className="text-xs text-green-700">
                {items.filter((i) => i.status === "listed").length} items
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/intake" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <Upload className="w-10 h-10 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Add Inventory</h3>
              <p className="text-sm text-gray-600">Scan and price new cards</p>
            </div>
          </Link>

          <Link href="/labels/print" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <Printer className="w-10 h-10 text-orange-600 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Print Labels</h3>
              <p className="text-sm text-gray-600">
                {pricedCards > 0
                  ? `${pricedCards} cards ready`
                  : "No cards ready yet"}
              </p>
            </div>
          </Link>

          <Link href="/inventory" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <Package className="w-10 h-10 text-purple-600 mb-3" />
              <h3 className="text-lg font-semibold mb-2">View Inventory</h3>
              <p className="text-sm text-gray-600">{totalCards} total cards</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
