"use client";

import { useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MigrateLabelTracking() {
  const [status, setStatus] = useState<string>("Ready");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs((prev) => [...prev, message]);
  };

  const migrateItems = async () => {
    setStatus("Running migration...");
    setLogs([]);

    try {
      addLog("🔍 Loading all inventory items...");
      const snapshot = await getDocs(collection(db, "inventory"));

      addLog(`✓ Found ${snapshot.docs.length} items`);

      let needsUpdate = 0;
      let alreadyMigrated = 0;

      const updates: Promise<void>[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();

        // Check if already has labelPrinted field
        if (data.labelPrinted === undefined) {
          needsUpdate++;

          // Set to false (needs to be printed)
          updates.push(
            updateDoc(doc(db, "inventory", docSnap.id), {
              labelPrinted: false,
              labelPrintedAt: null,
            }),
          );
        } else {
          alreadyMigrated++;
        }
      });

      addLog(`📊 Analysis:`);
      addLog(`  - Need migration: ${needsUpdate}`);
      addLog(`  - Already migrated: ${alreadyMigrated}`);

      if (needsUpdate === 0) {
        addLog("✓ All items already have label tracking!");
        setStatus("✓ Migration complete - nothing to update");
        toast.success("All items already migrated!");
        return;
      }

      addLog(`⏳ Updating ${needsUpdate} items...`);
      await Promise.all(updates);

      addLog(`✅ SUCCESS! Updated ${needsUpdate} items`);
      setStatus("✅ Migration complete");
      toast.success(`Migrated ${needsUpdate} items successfully!`);
    } catch (error: any) {
      addLog(`❌ ERROR: ${error.message}`);
      setStatus("❌ Migration failed");
      toast.error("Migration failed: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">🔧 Migrate Label Tracking</h1>
        <p className="text-gray-600 mb-8">
          Add label tracking fields to existing inventory items
        </p>

        {/* Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">Status</h2>
          <div className="text-lg font-mono">{status}</div>
        </div>

        {/* Action */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Run Migration</h2>
          <p className="text-sm text-gray-600 mb-4">
            This will add{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              labelPrinted: false
            </code>{" "}
            to all items that don't have it yet.
          </p>
          <Button
            onClick={migrateItems}
            className="bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            Run Migration
          </Button>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">
                No logs yet. Click "Run Migration" to start.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-2">ℹ️ What This Does</h2>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Before migration:</strong>
            </p>
            <pre className="bg-blue-100 p-2 rounded">
              {`{
  cardName: "Charizard",
  sellPrice: 100
  // No labelPrinted field
}`}
            </pre>

            <p className="mt-4">
              <strong>After migration:</strong>
            </p>
            <pre className="bg-blue-100 p-2 rounded">
              {`{
  cardName: "Charizard",
  sellPrice: 100,
  labelPrinted: false,     ← Added
  labelPrintedAt: null     ← Added
}`}
            </pre>

            <p className="mt-4">
              <strong>This allows:</strong>
            </p>
            <ul className="list-disc list-inside ml-4">
              <li>Label printing page to show items needing labels</li>
              <li>Track which items have been printed</li>
              <li>Prevent duplicate label printing</li>
              <li>Enable reprint functionality</li>
            </ul>

            <p className="mt-4">
              <strong>Safe to run multiple times:</strong>
            </p>
            <p className="ml-4">
              ✓ Only updates items missing the field
              <br />
              ✓ Won't overwrite existing label status
              <br />✓ No data loss
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
