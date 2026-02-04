"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CheckFirebase() {
  const [checks, setChecks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addCheck = (msg: string) => {
    setChecks((prev) => [...prev, msg]);
    console.log(msg);
  };

  const checkFirebaseSetup = async () => {
    setLoading(true);
    setChecks([]);

    addCheck("🔍 Starting Firebase setup check...\n");

    // Check 1: Environment variables
    addCheck("✓ Check 1: Environment Variables");
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    let allSet = true;
    Object.entries(config).forEach(([key, value]) => {
      const status = value ? "✅" : "❌";
      addCheck(`  ${status} ${key}: ${value ? "SET" : "MISSING"}`);
      if (!value) allSet = false;
    });

    if (!allSet) {
      addCheck("\n❌ FIREBASE NOT CONFIGURED!");
      addCheck("You need to create a .env.local file with:");
      addCheck("NEXT_PUBLIC_FIREBASE_API_KEY=...");
      addCheck("NEXT_PUBLIC_FIREBASE_PROJECT_ID=...");
      addCheck("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...");
      addCheck("etc.");
      setLoading(false);
      return;
    }

    addCheck("\n✓ Check 2: Firebase Client Import");
    try {
      const { db } = await import("@/lib/firebase/client");

      if (!db) {
        addCheck("❌ db is undefined!");
        addCheck("Firebase client failed to initialize");
        setLoading(false);
        return;
      }

      addCheck("✅ Firebase db initialized");
      addCheck(`  Project: ${config.projectId}\n`);

      // Check 3: Try Firestore operation with timeout
      addCheck("✓ Check 3: Testing Firestore Connection");

      try {
        const { collection, addDoc, serverTimestamp } =
          await import("firebase/firestore");

        addCheck("  Attempting write with 10s timeout...");

        const writePromise = addDoc(collection(db, "inventory"), {
          test: "Connection Test",
          timestamp: serverTimestamp(),
          sku: "TEST-" + Date.now(),
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout after 10 seconds")),
            10000,
          ),
        );

        const docRef = (await Promise.race([
          writePromise,
          timeoutPromise,
        ])) as any;

        addCheck(`✅ Write successful!`);
        addCheck(`  Document ID: ${docRef.id}`);
        addCheck(`\n🎉 FIREBASE IS FULLY WORKING!`);
        addCheck("Your intake page should work now.");
      } catch (firestoreError: any) {
        addCheck(
          `❌ Firestore Error: ${firestoreError.code || firestoreError.message}`,
        );

        if (firestoreError.message?.includes("Timeout")) {
          addCheck("\n⏱️ CONNECTION TIMEOUT");
          addCheck("Possible causes:");
          addCheck("  1. Slow internet connection");
          addCheck("  2. Firebase project not accessible");
          addCheck("  3. Wrong project ID in .env.local");
        } else if (firestoreError.code === "permission-denied") {
          addCheck("\n🔒 PERMISSION DENIED");
          addCheck("Firebase rules are blocking writes.");
          addCheck("\nFix: Update Firestore rules to:");
          addCheck("allow read, write: if true;");
        } else {
          addCheck(`\nError details: ${firestoreError.message}`);
        }
      }
    } catch (importError: any) {
      addCheck(`❌ Import Error: ${importError.message}`);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">🔍 Check Firebase Setup</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Button
            onClick={checkFirebaseSetup}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? "Checking..." : "Check Firebase Setup"}
          </Button>
        </div>

        {checks.length > 0 && (
          <div className="bg-gray-900 text-green-400 rounded-lg p-6 font-mono text-sm overflow-auto">
            {checks.map((check, i) => (
              <div
                key={i}
                className={check.includes("❌") ? "text-red-400" : ""}
              >
                {check}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
