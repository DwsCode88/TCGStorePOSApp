"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

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
  inventoryData: any;
}

export default function BulkConsignmentIntake() {
  const [file, setFile] = useState<File | null>(null);
  const [vendorCode, setVendorCode] = useState("");
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });

  const parseConsignmentCSV = (text: string): ConsignmentCard[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const cards: ConsignmentCard[] = [];

    console.log(`📄 CSV has ${lines.length} lines (including header)`);

    for (let i = 1; i < lines.length; i++) {
      // Split by comma, handling quoted fields
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
      const cards = parseConsignmentCSV(text);

      if (cards.length === 0) {
        alert("No valid cards found in CSV");
        return;
      }

      const parsed: ParsedCard[] = cards.map((card) => ({
        consignmentCard: card,
        inventoryData: {
          // Card Info
          name: card.productName,
          set: card.setName,
          number: card.number,
          rarity: card.rarity,
          game: card.productLine,

          // Condition & Pricing
          condition: card.condition,
          buyPrice: parseFloat(card.tcgMarketPrice) || 0,
          sellPrice: parseFloat(card.tcgMarketPrice) * 1.3 || 0, // 30% markup

          // Quantity
          quantity: card.quantity,

          // Consignment Info
          vendorCode: "", // Will be set on export
          isConsignment: true,

          // TCGPlayer Info
          tcgplayerId: card.tcgplayerId,
          tcgMarketPrice: parseFloat(card.tcgMarketPrice) || 0,
          imageUrl: card.photoUrl,

          // Metadata
          dateAdded: new Date().toISOString(),
          addedBy: "bulk-consignment-import",
          source: "tcgplayer-consignment-csv",
        },
      }));

      setParsedCards(parsed);
      console.log(`📋 Preview: ${cards.length} cards ready to export`);
    } catch (error: any) {
      console.error("Error parsing CSV:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const uploadToFirebase = async () => {
    if (!vendorCode.trim()) {
      alert("Please enter a vendor code");
      return;
    }

    if (parsedCards.length === 0) {
      alert("Please preview cards first");
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: parsedCards.length });

    console.log(
      `\n🚀 Uploading ${parsedCards.length} cards to Firebase with vendor code: ${vendorCode}`,
    );

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsedCards.length; i++) {
      const parsed = parsedCards[i];

      try {
        const cardData = {
          ...parsed.inventoryData,
          vendorCode: vendorCode.toUpperCase(),
          dateAdded: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "inventory"), cardData);
        console.log(
          `✅ [${i + 1}/${parsedCards.length}] Uploaded: ${parsed.consignmentCard.productName} (${docRef.id})`,
        );
        successCount++;
      } catch (error: any) {
        console.error(
          `❌ [${i + 1}/${parsedCards.length}] Error: ${parsed.consignmentCard.productName}`,
          error,
        );
        errorCount++;
      }

      setUploadProgress({ current: i + 1, total: parsedCards.length });

      // Small delay to avoid overwhelming Firestore
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setUploading(false);

    console.log(`\n📊 UPLOAD COMPLETE:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    alert(
      `Upload Complete!\n✅ ${successCount} cards added to inventory\n❌ ${errorCount} errors`,
    );
  };

  const exportToJSON = () => {
    if (!vendorCode.trim()) {
      alert("Please enter a vendor code");
      return;
    }

    if (parsedCards.length === 0) {
      alert("Please preview cards first");
      return;
    }

    console.log(
      `\n📦 Exporting ${parsedCards.length} cards with vendor code: ${vendorCode}`,
    );

    // Add vendor code to all cards
    const exportData = parsedCards.map((parsed) => ({
      ...parsed.inventoryData,
      vendorCode: vendorCode.toUpperCase(),
    }));

    // Create JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consignment_${vendorCode.toLowerCase()}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${exportData.length} cards to JSON`);
    console.log(
      `💰 Total Value: $${exportData.reduce((sum, c) => sum + c.buyPrice * c.quantity, 0).toFixed(2)}`,
    );

    alert(
      `✅ Exported ${exportData.length} cards!\n\nFile: consignment_${vendorCode.toLowerCase()}_${Date.now()}.json\n\nYou can now import this JSON to your inventory system.`,
    );
  };

  const exportToCSV = () => {
    if (!vendorCode.trim()) {
      alert("Please enter a vendor code");
      return;
    }

    if (parsedCards.length === 0) {
      alert("Please preview cards first");
      return;
    }

    const csvLines = [
      "Name,Set,Number,Rarity,Condition,Quantity,Buy Price,Sell Price,Vendor Code,TCG ID,Image URL",
    ];

    parsedCards.forEach((parsed) => {
      const data = parsed.inventoryData;
      csvLines.push(
        [
          `"${data.name}"`,
          `"${data.set}"`,
          `"${data.number}"`,
          `"${data.rarity}"`,
          data.condition,
          data.quantity,
          data.buyPrice.toFixed(2),
          data.sellPrice.toFixed(2),
          vendorCode.toUpperCase(),
          data.tcgplayerId,
          `"${data.imageUrl}"`,
        ].join(","),
      );
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consignment_${vendorCode.toLowerCase()}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`✅ Exported ${parsedCards.length} cards to CSV!`);
  };

  const totalValue = parsedCards.reduce(
    (sum, c) =>
      sum +
      (parseFloat(c.consignmentCard.tcgMarketPrice) || 0) *
        c.consignmentCard.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">📦 Bulk Consignment Intake</h1>
        <p className="text-gray-600 mb-8">
          Upload TCGPlayer consignment CSV and assign vendor code
        </p>

        {/* Step 1: Upload CSV */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Step 1: Upload CSV File
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              TCGPlayer Consignment CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm border border-gray-300 rounded p-2"
            />
            {file && (
              <p className="text-sm text-green-600 mt-2">✓ {file.name}</p>
            )}
          </div>

          <button
            onClick={previewCards}
            disabled={!file}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            📋 Preview Cards
          </button>
        </div>

        {/* Step 2: Assign Vendor Code */}
        {parsedCards.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Step 2: Assign Vendor Code & Export
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Vendor Code (e.g., KYLE, JOHN, STORE)
              </label>
              <input
                type="text"
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value.toUpperCase())}
                placeholder="Enter vendor code"
                className="w-full border border-gray-300 rounded p-2 uppercase"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                This code will be added to all {parsedCards.length} cards
              </p>
            </div>

            {/* Preview Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-700">
                  {parsedCards.length}
                </div>
                <div className="text-sm text-gray-600">Total Cards</div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-700">
                  ${totalValue.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  Total Value (Buy Price)
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-700">
                  ${(totalValue * 1.3).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  Sell Value (30% markup)
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={exportToJSON}
                disabled={!vendorCode.trim()}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                📥 Export to JSON
              </button>
              <button
                onClick={exportToCSV}
                disabled={!vendorCode.trim()}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                📥 Export to CSV
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-2 text-center">
              Export files can be imported to your inventory system
            </p>
          </div>
        )}

        {/* Step 3: Card List */}
        {parsedCards.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Cards Preview</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">Card</th>
                    <th className="text-left p-3">Set</th>
                    <th className="text-left p-3">Number</th>
                    <th className="text-left p-3">Condition</th>
                    <th className="text-left p-3">Qty</th>
                    <th className="text-left p-3">Buy Price</th>
                    <th className="text-left p-3">Sell Price</th>
                    <th className="text-left p-3">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedCards.map((parsed, i) => {
                    const card = parsed.consignmentCard;
                    const buyPrice = parseFloat(card.tcgMarketPrice) || 0;
                    const sellPrice = buyPrice * 1.3;

                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-500">{i + 1}</td>
                        <td className="p-3">
                          <div className="font-medium text-xs">
                            {card.productName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {card.rarity}
                          </div>
                        </td>
                        <td className="p-3 text-xs">{card.setName}</td>
                        <td className="p-3 text-xs">{card.number}</td>
                        <td className="p-3 text-xs">{card.condition}</td>
                        <td className="p-3 text-xs">{card.quantity}</td>
                        <td className="p-3 text-xs font-semibold text-blue-700">
                          ${buyPrice.toFixed(2)}
                        </td>
                        <td className="p-3 text-xs font-semibold text-green-700">
                          ${sellPrice.toFixed(2)}
                        </td>
                        <td className="p-3">
                          {vendorCode ? (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                              {vendorCode}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
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
    </div>
  );
}
