"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { calculateCostBasis, calculateSellPrice } from "@/lib/pricing";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vendorCode?: string;
}

interface BulkUploadCard {
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

interface ParsedBulkCard {
  card: BulkUploadCard;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  firestoreId?: string;
}

type AcquisitionType = "buy" | "trade" | "consignment";

export default function BulkUploadTab() {
  const [file, setFile] = useState<File | null>(null);
  const [acquisitionType, setAcquisitionType] =
    useState<AcquisitionType>("buy");
  const [vendorCode, setVendorCode] = useState("");
  const [consignorPercent, setConsignorPercent] = useState(70);
  const [parsedCards, setParsedCards] = useState<ParsedBulkCard[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Customer dropdown state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customersSnapshot = await getDocs(collection(db, "customers"));
        const customersList: Customer[] = customersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unknown",
          email: doc.data().email,
          phone: doc.data().phone,
          vendorCode:
            doc.data().vendorCode ||
            doc.data().name?.substring(0, 4).toUpperCase(),
        }));
        setCustomers(customersList);
        console.log(`✅ Loaded ${customersList.length} customers`);
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  // Update vendor code when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer) {
        setVendorCode(
          customer.vendorCode || customer.name.substring(0, 4).toUpperCase(),
        );
      }
    }
  }, [selectedCustomerId, customers]);

  const parseCSV = (text: string): BulkUploadCard[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const cards: BulkUploadCard[] = [];

    console.log(`📄 CSV has ${lines.length} lines`);

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

      if (fields.length < 14) continue;

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

    console.log(`✅ Parsed ${cards.length} cards`);
    return cards;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setParsedCards([]);
    }
  };

  const previewCards = async () => {
    if (!file) {
      alert("Please upload a CSV file");
      return;
    }

    try {
      const text = await file.text();
      const cards = parseCSV(text);

      if (cards.length === 0) {
        alert("No valid cards found in CSV");
        return;
      }

      const parsed: ParsedBulkCard[] = cards.map((card) => ({
        card,
        status: "pending",
      }));

      setParsedCards(parsed);
      console.log(`📋 Preview: ${cards.length} cards ready`);
    } catch (error: any) {
      console.error("Error:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const uploadToFirebase = async () => {
    if (acquisitionType === "consignment" && !vendorCode.trim()) {
      alert("Please enter a vendor code for consignment");
      return;
    }

    if (parsedCards.length === 0) {
      alert("Please preview cards first");
      return;
    }

    setUploading(true);
    setProgress({ current: 0, total: parsedCards.length });

    const customerName = selectedCustomerId
      ? customers.find((c) => c.id === selectedCustomerId)?.name
      : null;

    console.log(
      `\n🚀 Uploading ${parsedCards.length} cards as ${acquisitionType.toUpperCase()}`,
    );
    if (acquisitionType === "consignment" && customerName) {
      console.log(`📦 Consignment for: ${customerName} (${vendorCode})`);
    }

    const updatedCards = [...parsedCards];

    for (let i = 0; i < parsedCards.length; i++) {
      const parsed = parsedCards[i];
      const card = parsed.card;

      updatedCards[i] = { ...parsed, status: "uploading" };
      setParsedCards([...updatedCards]);

      try {
        const marketPrice = parseFloat(card.tcgMarketPrice) || 0;

        // Calculate prices based on acquisition type
        let costBasis = 0;
        let sellPrice = 0;

        if (acquisitionType === "buy") {
          costBasis = calculateCostBasis(
            marketPrice,
            acquisitionType,
            card.condition,
          );
          sellPrice = calculateSellPrice(costBasis);
        } else if (acquisitionType === "trade") {
          costBasis = 0;
          sellPrice = calculateSellPrice(marketPrice);
        } else if (acquisitionType === "consignment") {
          costBasis = 0;
          sellPrice = marketPrice * 1.3;
        }

        // Generate SKU
        const generateSKU = () => {
          const gamePrefix = card.productLine.substring(0, 3).toUpperCase();
          const setCode = card.setName
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 4)
            .toUpperCase();
          const cardNum = card.number
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 4)
            .toUpperCase();

          if (acquisitionType === "consignment" && vendorCode) {
            return `${gamePrefix}-${setCode}-${cardNum}-${vendorCode}`;
          }
          return `${gamePrefix}-${setCode}-${cardNum}`;
        };

        const sku = generateSKU();

        console.log(`📦 Preparing card ${i + 1}:`, {
          name: card.productName,
          sku: sku,
          vendorCode: vendorCode,
          acquisitionType: acquisitionType,
        });

        const cardData = {
          // Card Info
          name: card.productName,
          set: card.setName,
          number: card.number,
          rarity: card.rarity,
          game: card.productLine.toLowerCase(),
          sku: sku,

          // Condition & Printing
          condition: card.condition,
          printing: "Normal",
          language: "English",

          // Prices
          marketPrice: marketPrice,
          costBasis: costBasis,
          sellPrice: sellPrice,

          // Quantity & Location
          quantity: card.quantity,
          location: "MAIN",

          // Acquisition
          acquisitionType: acquisitionType,
          acquisitionDate: serverTimestamp(),

          // Consignment-specific
          ...(acquisitionType === "consignment" && {
            isConsignment: true,
            vendorCode: vendorCode.toUpperCase(),
            consignorPayoutPercent: consignorPercent,
            ...(selectedCustomerId && { customerId: selectedCustomerId }),
          }),

          // TCGPlayer Info
          tcgplayerId: card.tcgplayerId,
          imageUrl: card.photoUrl,

          // Metadata
          dateAdded: serverTimestamp(),
          addedBy: "bulk-upload",
          source: "tcgplayer-csv-bulk-import",
        };

        const docRef = await addDoc(collection(db, "inventory"), cardData);

        updatedCards[i] = {
          ...parsed,
          status: "success",
          firestoreId: docRef.id,
        };

        console.log(
          `✅ [${i + 1}/${parsedCards.length}] ${card.productName} (SKU: ${sku}, ID: ${docRef.id})`,
        );
      } catch (error: any) {
        console.error(
          `❌ [${i + 1}/${parsedCards.length}] Error uploading ${card.productName}:`,
          error,
        );
        updatedCards[i] = {
          ...parsed,
          status: "error",
          error: error.message,
        };
      }

      setProgress({ current: i + 1, total: parsedCards.length });
      setParsedCards([...updatedCards]);

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setUploading(false);

    const successCount = updatedCards.filter(
      (c) => c.status === "success",
    ).length;
    const errorCount = updatedCards.filter((c) => c.status === "error").length;

    console.log(
      `\n📊 COMPLETE: ✅ ${successCount} success, ❌ ${errorCount} errors`,
    );

    let alertMessage = `Upload Complete!\n✅ ${successCount} cards added\n❌ ${errorCount} errors`;
    if (acquisitionType === "consignment" && customerName) {
      alertMessage += `\n\n📦 Consignment for: ${customerName}`;
    }
    alert(alertMessage);
  };

  const successCount = parsedCards.filter((c) => c.status === "success").length;
  const errorCount = parsedCards.filter((c) => c.status === "error").length;
  const pendingCount = parsedCards.filter((c) => c.status === "pending").length;

  const totalCost = parsedCards.reduce((sum, p) => {
    if (acquisitionType === "buy") {
      const marketPrice = parseFloat(p.card.tcgMarketPrice) || 0;
      const costBasis = calculateCostBasis(
        marketPrice,
        "buy",
        p.card.condition,
      );
      return sum + costBasis * p.card.quantity;
    }
    return sum;
  }, 0);

  const totalSellValue = parsedCards.reduce((sum, p) => {
    const marketPrice = parseFloat(p.card.tcgMarketPrice) || 0;
    const sellPrice =
      acquisitionType === "consignment"
        ? marketPrice * 1.3
        : calculateSellPrice(
            acquisitionType === "buy"
              ? calculateCostBasis(marketPrice, "buy", p.card.condition)
              : marketPrice,
          );
    return sum + sellPrice * p.card.quantity;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📦 Bulk CSV Upload</h3>
        <p className="text-sm text-blue-700">
          Upload a TCGPlayer CSV to add multiple cards at once. Choose
          acquisition type and the system will calculate pricing automatically.
        </p>
      </div>

      {/* Step 1: Upload File */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Step 1: Upload CSV File</h3>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm border border-gray-300 rounded p-2 mb-4"
        />

        {file && <p className="text-sm text-green-600 mb-4">✓ {file.name}</p>}

        <button
          onClick={previewCards}
          disabled={!file}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          📋 Preview Cards
        </button>
      </div>

      {/* Step 2: Configure Acquisition */}
      {parsedCards.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Step 2: Configure Acquisition
          </h3>

          {/* Acquisition Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Acquisition Type
            </label>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setAcquisitionType("buy")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  acquisitionType === "buy"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="font-semibold">💵 Buy</div>
                <div className="text-xs text-gray-600">
                  Purchase from customer
                </div>
              </button>

              <button
                onClick={() => setAcquisitionType("trade")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  acquisitionType === "trade"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="font-semibold">🔄 Trade</div>
                <div className="text-xs text-gray-600">Trade-in credit</div>
              </button>

              <button
                onClick={() => setAcquisitionType("consignment")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  acquisitionType === "consignment"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="font-semibold">🤝 Consignment</div>
                <div className="text-xs text-gray-600">Sell on behalf</div>
              </button>
            </div>
          </div>

          {/* Consignment Options */}
          {acquisitionType === "consignment" && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">
                  Select Customer
                </label>
                {loadingCustomers ? (
                  <div className="text-sm text-gray-500">
                    Loading customers...
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 mb-2"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}{" "}
                        {customer.email ? `(${customer.email})` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <div className="text-xs text-gray-600 mt-1">
                  {customers.length === 0 && !loadingCustomers && (
                    <span className="text-orange-600">
                      No customers found. Please add customers first or enter
                      vendor code manually below.
                    </span>
                  )}
                  {customers.length > 0 && (
                    <span>
                      {customers.length} customer
                      {customers.length !== 1 ? "s" : ""} available
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">
                  Vendor Code {selectedCustomerId && "(Auto-filled)"}
                </label>
                <input
                  type="text"
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value.toUpperCase())}
                  placeholder="e.g., KYLE, JOHN"
                  className="w-full border border-gray-300 rounded p-2 uppercase"
                  maxLength={20}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {selectedCustomerId
                    ? "Auto-filled from selected customer. You can edit if needed."
                    : "Enter vendor code manually or select a customer above"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Consignor Payout: {consignorPercent}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="90"
                  value={consignorPercent}
                  onChange={(e) =>
                    setConsignorPercent(parseInt(e.target.value))
                  }
                  className="w-full"
                />
                <div className="text-xs text-gray-600 mt-1">
                  Store keeps {100 - consignorPercent}%
                </div>
              </div>
            </div>
          )}

          {/* Preview Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-700">
                {parsedCards.length}
              </div>
              <div className="text-sm text-gray-600">Total Cards</div>
            </div>

            {acquisitionType === "buy" && (
              <div className="bg-red-50 p-4 rounded">
                <div className="text-2xl font-bold text-red-700">
                  ${totalCost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Cost</div>
              </div>
            )}

            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-700">
                ${totalSellValue.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Sell Value</div>
            </div>

            <div className="bg-purple-50 p-4 rounded">
              <div className="text-2xl font-bold text-purple-700">
                ${(totalSellValue - totalCost).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">
                {acquisitionType === "consignment"
                  ? "Store Profit"
                  : "Potential Profit"}
              </div>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={uploadToFirebase}
            disabled={
              uploading ||
              (acquisitionType === "consignment" && !vendorCode.trim())
            }
            className="w-full bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {uploading
              ? `⬆️ Uploading... (${progress.current}/${progress.total})`
              : acquisitionType === "consignment" && selectedCustomerId
                ? `⬆️ Upload ${pendingCount} Cards for ${customers.find((c) => c.id === selectedCustomerId)?.name || "Customer"}`
                : `⬆️ Upload ${pendingCount} Cards as ${acquisitionType.toUpperCase()}`}
          </button>

          {successCount > 0 && (
            <div className="mt-4 bg-green-100 border border-green-300 rounded p-3 text-sm text-green-800">
              ✅ Successfully uploaded {successCount} cards!
              {errorCount > 0 && ` (${errorCount} errors)`}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Card List */}
      {parsedCards.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Card Preview ({parsedCards.length} cards)
          </h3>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Card</th>
                  <th className="text-left p-2">Set</th>
                  <th className="text-left p-2">Condition</th>
                  <th className="text-left p-2">Qty</th>
                  <th className="text-left p-2">Market</th>
                  <th className="text-left p-2">Cost</th>
                  <th className="text-left p-2">Sell</th>
                </tr>
              </thead>
              <tbody>
                {parsedCards.map((parsed, i) => {
                  const card = parsed.card;
                  const marketPrice = parseFloat(card.tcgMarketPrice) || 0;
                  const costBasis =
                    acquisitionType === "buy"
                      ? calculateCostBasis(marketPrice, "buy", card.condition)
                      : 0;
                  const sellPrice =
                    acquisitionType === "consignment"
                      ? marketPrice * 1.3
                      : calculateSellPrice(
                          acquisitionType === "buy" ? costBasis : marketPrice,
                        );

                  return (
                    <tr
                      key={i}
                      className={`border-b ${
                        parsed.status === "success"
                          ? "bg-green-50"
                          : parsed.status === "error"
                            ? "bg-red-50"
                            : parsed.status === "uploading"
                              ? "bg-yellow-50"
                              : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="p-2">
                        {parsed.status === "pending" && (
                          <span className="text-gray-500 text-xs">⏳</span>
                        )}
                        {parsed.status === "uploading" && (
                          <span className="text-yellow-600 text-xs">⬆️</span>
                        )}
                        {parsed.status === "success" && (
                          <span className="text-green-600 text-xs">✅</span>
                        )}
                        {parsed.status === "error" && (
                          <span className="text-red-600 text-xs">❌</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-xs">
                          {card.productName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {card.rarity}
                        </div>
                      </td>
                      <td className="p-2 text-xs">{card.setName}</td>
                      <td className="p-2 text-xs">{card.condition}</td>
                      <td className="p-2 text-xs">{card.quantity}</td>
                      <td className="p-2 text-xs">${marketPrice.toFixed(2)}</td>
                      <td className="p-2 text-xs text-red-600">
                        {acquisitionType === "buy"
                          ? `$${costBasis.toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="p-2 text-xs font-semibold text-green-600">
                        ${sellPrice.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
