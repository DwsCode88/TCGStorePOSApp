"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

interface ConsignmentCard {
  tcgplayerId: string;
  productLine: string;
  setName: string;
  productName: string;
  number: string;
  rarity: string;
  condition: string;
  tcgMarketPrice: string;
  quantity: number;
  photoUrl: string;
}

interface ParsedCard {
  consignmentCard: ConsignmentCard;
  status: "pending" | "success" | "error" | "duplicate";
  error?: string;
  firestoreId?: string;
  existingBatch?: string;
  existingVendor?: string;
  isDuplicate?: boolean;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vendorCode: string;
  payoutPercentage?: number;
}

export default function BulkConsignmentIntake() {
  const [file, setFile] = useState<File | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [vendorCode, setVendorCode] = useState("");
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "customers"));
      const loadedCustomers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Customer[];
      setCustomers(loadedCustomers);
      console.log(`📋 Loaded ${loadedCustomers.length} customers`);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setSelectedCustomer(customer || null);
    setVendorCode(customer?.vendorCode || "");
  };

  const parseConsignmentCSV = (text: string): ConsignmentCard[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const cards: ConsignmentCard[] = [];

    console.log(`📄 CSV has ${lines.length} lines (including header)`);

    for (let i = 1; i < lines.length; i++) {
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      fields.push(current.trim());

      if (fields.length < 14) {
        console.log(`⚠️ Skipping line ${i}: only ${fields.length} fields`);
        continue;
      }

      const cleanField = (field: string) => field.replace(/^"|"$/g, "").trim();

      cards.push({
        tcgplayerId: cleanField(fields[0]),
        productLine: cleanField(fields[1]),
        setName: cleanField(fields[2]),
        productName: cleanField(fields[3]),
        number: cleanField(fields[5]),
        rarity: cleanField(fields[6]),
        condition: cleanField(fields[7]),
        tcgMarketPrice: cleanField(fields[8]),
        quantity: parseInt(fields[13]) || 1,
        photoUrl: fields[15] ? cleanField(fields[15]) : "",
      });
    }

    console.log(`✅ Parsed ${cards.length} valid cards`);
    return cards;
  };

  const checkForDuplicates = async (cards: ConsignmentCard[]) => {
    console.log("🔍 Checking for duplicates in existing inventory...");
    setChecking(true);

    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const existingCards = snapshot.docs.map((doc) => ({
        id: doc.id,
        tcgplayerId: doc.data().tcgplayerId as string | undefined,
        condition: doc.data().condition as string | undefined,
        customerVendorCode: doc.data().customerVendorCode as string | undefined,
        batchId: doc.data().batchId as string | undefined,
      }));

      const parsed: ParsedCard[] = cards.map((card) => {
        // Check if this exact card exists (matching TCGPlayer ID and condition)
        const duplicate = existingCards.find(
          (existing) =>
            existing.tcgplayerId === card.tcgplayerId &&
            existing.condition?.toLowerCase() === card.condition.toLowerCase(),
        );

        if (duplicate) {
          console.log(
            `⚠️ Duplicate found: ${card.productName} - Already uploaded by ${duplicate.customerVendorCode || "unknown vendor"}`,
          );
          return {
            consignmentCard: card,
            status: "duplicate" as const,
            isDuplicate: true,
            existingBatch: duplicate.batchId || "Unknown batch",
            existingVendor: duplicate.customerVendorCode || "Unknown vendor",
          };
        }

        return {
          consignmentCard: card,
          status: "pending" as const,
          isDuplicate: false,
        };
      });

      setParsedCards(parsed);

      const duplicateCount = parsed.filter((p) => p.isDuplicate).length;
      const newCount = parsed.filter((p) => !p.isDuplicate).length;

      console.log(
        `✅ Duplicate check complete: ${newCount} new, ${duplicateCount} duplicates`,
      );

      if (duplicateCount > 0) {
        alert(
          `⚠️ Found ${duplicateCount} duplicate cards!\n\n${newCount} new cards can be uploaded.\n\nDuplicates are highlighted in yellow.`,
        );
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
      alert("Failed to check for duplicates");
    } finally {
      setChecking(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const cards = parseConsignmentCSV(text);

      if (cards.length === 0) {
        alert("No valid cards found in CSV");
        return;
      }

      // Automatically check for duplicates
      await checkForDuplicates(cards);
    };

    reader.readAsText(uploadedFile);
  };

  const uploadToInventory = async () => {
    if (!vendorCode.trim()) {
      alert("Please enter a vendor code");
      return;
    }

    // Filter cards based on skipDuplicates setting
    const cardsToUpload = skipDuplicates
      ? parsedCards.filter((p) => !p.isDuplicate)
      : parsedCards;

    if (cardsToUpload.length === 0) {
      alert("No cards to upload!");
      return;
    }

    const duplicateCount = parsedCards.filter((p) => p.isDuplicate).length;

    const confirmMessage =
      skipDuplicates && duplicateCount > 0
        ? `Upload ${cardsToUpload.length} NEW cards?\n\n${duplicateCount} duplicates will be SKIPPED.`
        : `Upload ${cardsToUpload.length} cards?`;

    if (!confirm(confirmMessage)) return;

    setUploading(true);
    setProgress({ current: 0, total: cardsToUpload.length });

    console.log(
      `📤 Uploading ${cardsToUpload.length} cards with vendor code: ${vendorCode}`,
    );

    for (let i = 0; i < cardsToUpload.length; i++) {
      const parsed = cardsToUpload[i];
      const card = parsed.consignmentCard;

      try {
        const buyPrice = parseFloat(card.tcgMarketPrice) || 0;
        const sellPrice = buyPrice * 1.3;

        const docRef = await addDoc(collection(db, "inventory"), {
          cardName: card.productName,
          setName: card.setName,
          number: card.number,
          game: card.productLine,
          condition: card.condition,
          rarity: card.rarity,
          costBasis: buyPrice,
          sellPrice: sellPrice,
          quantity: card.quantity,
          customerVendorCode: vendorCode.toUpperCase(),
          customerId: selectedCustomer?.id || null,
          acquisitionType: "consignment",
          tcgplayerId: card.tcgplayerId,
          imageUrl: card.photoUrl,
          status: "pending",
          createdAt: new Date(),
        });

        parsed.status = "success";
        parsed.firestoreId = docRef.id;
        console.log(`✅ Uploaded: ${card.productName}`);
      } catch (error: any) {
        parsed.status = "error";
        parsed.error = error.message;
        console.error(`❌ Failed: ${card.productName}`, error);
      }

      setProgress({ current: i + 1, total: cardsToUpload.length });
      setParsedCards([...parsedCards]);
    }

    setUploading(false);

    const successCount = cardsToUpload.filter(
      (p) => p.status === "success",
    ).length;
    const failCount = cardsToUpload.filter((p) => p.status === "error").length;
    const skippedCount = parsedCards.filter(
      (p) => p.isDuplicate && skipDuplicates,
    ).length;

    let message = `✅ Upload complete!\n\n`;
    message += `${successCount} cards uploaded successfully\n`;
    if (failCount > 0) message += `${failCount} cards failed\n`;
    if (skippedCount > 0) message += `${skippedCount} duplicates skipped`;

    alert(message);
  };

  const totalValue = parsedCards
    .filter((p) => !p.isDuplicate || !skipDuplicates)
    .reduce(
      (sum, p) =>
        sum +
        parseFloat(p.consignmentCard.tcgMarketPrice) *
          p.consignmentCard.quantity,
      0,
    );

  const duplicateCount = parsedCards.filter((p) => p.isDuplicate).length;
  const newCount = parsedCards.filter((p) => !p.isDuplicate).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Bulk Consignment Intake</h1>
        <p className="text-gray-600 mb-6">
          Upload TCGPlayer CSV with vendor code
        </p>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Upload CSV File</h2>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="border rounded px-4 py-2 w-full"
            disabled={checking || uploading}
          />
          {checking && (
            <div className="mt-2 text-blue-600">
              🔍 Checking for duplicates...
            </div>
          )}
        </div>

        {/* Vendor Code */}
        {parsedCards.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              2. Select Customer / Assign Vendor Code
            </h2>

            {/* Customer Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Existing Customer
              </label>
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="border rounded px-4 py-2 w-full mb-2"
                disabled={uploading}
              >
                <option value="">-- Select a customer --</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.vendorCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Vendor Code Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Enter Vendor Code Manually
              </label>
              <input
                type="text"
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value.toUpperCase())}
                placeholder="Enter vendor code (e.g., KYLE)"
                className="border rounded px-4 py-2 w-full text-lg font-mono"
                disabled={uploading}
              />
              {selectedCustomer && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected:{" "}
                  <span className="font-semibold">{selectedCustomer.name}</span>
                  {selectedCustomer.payoutPercentage && (
                    <span className="ml-2">
                      (Payout: {selectedCustomer.payoutPercentage}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Duplicate Options */}
        {duplicateCount > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-yellow-900">
              ⚠️ {duplicateCount} Duplicate Card
              {duplicateCount !== 1 ? "s" : ""} Found
            </h2>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-yellow-900">
                  Skip duplicates (recommended - upload only {newCount} new
                  cards)
                </span>
              </label>
            </div>
            <div className="text-sm text-yellow-800">
              {skipDuplicates
                ? `✅ Will upload ${newCount} new cards, skip ${duplicateCount} duplicates`
                : `⚠️ Will upload ALL ${parsedCards.length} cards (including duplicates)`}
            </div>
          </div>
        )}

        {/* Summary */}
        {parsedCards.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">3. Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="border rounded p-3">
                <div className="text-sm text-gray-600">Total Cards</div>
                <div className="text-2xl font-bold">{parsedCards.length}</div>
              </div>
              <div className="border rounded p-3 bg-green-50">
                <div className="text-sm text-green-600">New Cards</div>
                <div className="text-2xl font-bold text-green-600">
                  {newCount}
                </div>
              </div>
              <div className="border rounded p-3 bg-yellow-50">
                <div className="text-sm text-yellow-600">Duplicates</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {duplicateCount}
                </div>
              </div>
              <div className="border rounded p-3">
                <div className="text-sm text-gray-600">Total Value</div>
                <div className="text-2xl font-bold">
                  ${totalValue.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              onClick={uploadToInventory}
              disabled={uploading || !vendorCode.trim()}
              className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {uploading
                ? `⬆️ Uploading... ${progress.current}/${progress.total}`
                : `⬆️ Upload ${skipDuplicates ? newCount : parsedCards.length} Cards to Inventory`}
            </button>
          </div>
        )}

        {/* Cards List */}
        {parsedCards.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Cards Preview</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {parsedCards.map((parsed, idx) => (
                <div
                  key={idx}
                  className={`border rounded p-3 ${
                    parsed.isDuplicate
                      ? "bg-yellow-50 border-yellow-400"
                      : parsed.status === "success"
                        ? "bg-green-50 border-green-400"
                        : parsed.status === "error"
                          ? "bg-red-50 border-red-400"
                          : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">
                        {parsed.consignmentCard.productName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {parsed.consignmentCard.setName} •{" "}
                        {parsed.consignmentCard.condition}
                      </div>
                      {parsed.isDuplicate && (
                        <div className="text-sm text-yellow-700 mt-1">
                          ⚠️ Already in inventory - Vendor:{" "}
                          {parsed.existingVendor}
                        </div>
                      )}
                      {parsed.status === "error" && (
                        <div className="text-sm text-red-600 mt-1">
                          ❌ Error: {parsed.error}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-bold">
                        ${parsed.consignmentCard.tcgMarketPrice}
                      </div>
                      <div className="text-sm text-gray-600">
                        Qty: {parsed.consignmentCard.quantity}
                      </div>
                      {parsed.isDuplicate && skipDuplicates && (
                        <div className="text-xs text-yellow-600 mt-1">
                          WILL SKIP
                        </div>
                      )}
                      {parsed.status === "success" && (
                        <div className="text-xs text-green-600 mt-1">
                          ✅ UPLOADED
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
