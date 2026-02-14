"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Package } from "lucide-react";

interface BatchInfo {
  batchId: string;
  batchStartTime: string;
  itemCount: number;
  totalValue: number;
  items: any[];
}

export const dynamic = "force-dynamic";

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      console.log("📦 Loading batches from Firebase...");
      const snapshot = await getDocs(collection(db, "inventory"));
      
      // Group items by batch
      const batchMap = new Map<string, any[]>();
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const batchId = data.batchId || "NO-BATCH";
        
        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, []);
        }
        
        batchMap.get(batchId)!.push({
          id: doc.id,
          ...data,
        });
      });

      // Convert to batch info array
      const batchInfos: BatchInfo[] = Array.from(batchMap.entries()).map(([batchId, items]) => {
        const totalValue = items.reduce((sum, item) => sum + (item.sellPrice || 0), 0);
        const batchStartTime = items[0]?.batchStartTime || new Date().toISOString();
        
        return {
          batchId,
          batchStartTime,
          itemCount: items.length,
          totalValue,
          items,
        };
      });

      // Sort by start time (newest first)
      batchInfos.sort((a, b) => 
        new Date(b.batchStartTime).getTime() - new Date(a.batchStartTime).getTime()
      );

      setBatches(batchInfos);
      console.log(`✅ Found ${batchInfos.length} batches`);
      toast.success(`Loaded ${batchInfos.length} batches`);
    } catch (error: any) {
      console.error("Failed to load batches:", error);
      toast.error("Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatch = async (batch: BatchInfo) => {
    const confirmed = confirm(
      `Delete batch "${batch.batchId}"?\n\n` +
      `This will permanently delete ${batch.itemCount} items worth $${batch.totalValue.toFixed(2)}.\n\n` +
      `This action CANNOT be undone!`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(batch.batchId);
    try {
      console.log(`🗑️ Deleting batch: ${batch.batchId}`);
      console.log(`Items to delete: ${batch.itemCount}`);

      // Delete all items in the batch
      await Promise.all(
        batch.items.map((item) => 
          deleteDoc(doc(db, "inventory", item.id))
        )
      );

      console.log(`✅ Deleted ${batch.itemCount} items from batch ${batch.batchId}`);
      toast.success(`Deleted batch "${batch.batchId}" (${batch.itemCount} items)`);

      // Reload batches
      await loadBatches();
    } catch (error: any) {
      console.error("Failed to delete batch:", error);
      toast.error(`Failed to delete batch: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg font-medium">Loading batches...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manage Batches</h1>
            <p className="text-gray-600">View and delete import batches</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/intake"
              className="inline-flex items-center px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ← Back to Intake
            </a>
            <Button onClick={loadBatches} variant="outline">
              🔄 Refresh
            </Button>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No batches found
            </h2>
            <p className="text-gray-600">
              Start adding items in the intake page to create batches.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => (
              <div
                key={batch.batchId}
                className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Package className="w-6 h-6 text-purple-600" />
                      <h3 className="text-xl font-bold font-mono">{batch.batchId}</h3>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-gray-500">Created</div>
                        <div className="text-sm font-medium">
                          {new Date(batch.batchStartTime).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Items</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {batch.itemCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Total Value</div>
                        <div className="text-2xl font-bold text-green-600">
                          ${batch.totalValue.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Avg Price</div>
                        <div className="text-2xl font-bold text-purple-600">
                          ${(batch.totalValue / batch.itemCount).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Item Preview */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-xs text-gray-500 mb-2">Sample Items:</div>
                      <div className="flex gap-2 flex-wrap">
                        {batch.items.slice(0, 5).map((item, i) => (
                          <div
                            key={i}
                            className="text-xs bg-gray-100 px-2 py-1 rounded"
                          >
                            {item.cardName} • ${item.sellPrice?.toFixed(2)}
                          </div>
                        ))}
                        {batch.items.length > 5 && (
                          <div className="text-xs text-gray-500 px-2 py-1">
                            +{batch.items.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleDeleteBatch(batch)}
                    disabled={deleting === batch.batchId}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting === batch.batchId ? "Deleting..." : "Delete Batch"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {batches.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-xl font-bold mb-4">Overall Stats</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm opacity-90">Total Batches</div>
                <div className="text-3xl font-bold">{batches.length}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Total Items</div>
                <div className="text-3xl font-bold">
                  {batches.reduce((sum, b) => sum + b.itemCount, 0)}
                </div>
              </div>
              <div>
                <div className="text-sm opacity-90">Total Value</div>
                <div className="text-3xl font-bold">
                  ${batches.reduce((sum, b) => sum + b.totalValue, 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}