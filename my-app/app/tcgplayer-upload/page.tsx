"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Check, AlertCircle } from "lucide-react";

interface ParsedCard {
  productName: string;
  setName: string;
  cardNumber: string;
  condition: string;
  printing: string;
  language: string;
  quantity: number;
  marketPrice: number;
  tcgplayerId?: string;
  rarity?: string;
  photoUrl?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  vendorCode?: string;
}

export const dynamic = "force-dynamic";

export default function TCGPlayerUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [batchStartTime, setBatchStartTime] = useState<string>("");

  // Duplicate checking
  const [duplicates, setDuplicates] = useState<ParsedCard[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Default settings
  const [defaultLocation, setDefaultLocation] = useState("A-1");
  const [defaultMarkup, setDefaultMarkup] = useState(30);
  const [defaultAcquisitionType, setDefaultAcquisitionType] = useState<
    "buy" | "trade" | "pull" | "consignment"
  >("buy");
  const [batchName, setBatchName] = useState("");
  const [expandQuantities, setExpandQuantities] = useState(false); // Create separate items for each quantity

  // Customer management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    vendorCode: "",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "customers"));
      const customerList = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        phone: doc.data().phone || "",
        email: doc.data().email || "",
        vendorCode: doc.data().vendorCode || "",
      }));
      setCustomers(customerList);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      toast.error("Customer name is required");
      return;
    }
    if (!newCustomer.phone && !newCustomer.email) {
      toast.error("Please provide phone or email");
      return;
    }

    try {
      const customerData = {
        name: newCustomer.name,
        phone: newCustomer.phone || "",
        email: newCustomer.email || "",
        vendorCode: newCustomer.vendorCode || "",
        createdAt: new Date().toISOString(),
        totalConsignments: 0,
        totalOwed: 0,
      };

      const docRef = await addDoc(collection(db, "customers"), customerData);
      const newCust: Customer = {
        id: docRef.id,
        ...customerData,
      };

      setCustomers([...customers, newCust]);
      setSelectedCustomerId(docRef.id);
      setNewCustomer({ name: "", phone: "", email: "", vendorCode: "" });
      setShowAddCustomerModal(false);
      toast.success(`Customer "${newCustomer.name}" added!`);
    } catch (error: any) {
      console.error("Error adding customer:", error);
      toast.error(`Failed to add customer: ${error.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }
      setFile(selectedFile);
      toast.success("File selected. Click 'Parse CSV' to preview.");
    }
  };

  const parseCSV = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        setLoading(false);
        return;
      }

      // Parse CSV properly handling quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            // Check for escaped quote
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++; // Skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }

        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);

      console.log("CSV Headers:", headers);

      // More specific matching for product/card name
      const productNameIndex = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        return (
          lower === "product name" ||
          lower === "product" ||
          lower === "card name" ||
          lower === "title" ||
          lower === "name"
        );
      });

      const setNameIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes("set") &&
          !h.toLowerCase().includes("product"),
      );
      const cardNumberIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes("number") || h.toLowerCase() === "card #",
      );
      const conditionIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("condition"),
      );
      const printingIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes("printing") ||
          h.toLowerCase().includes("finish"),
      );
      const languageIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("language"),
      );
      const quantityIndex = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        // Check "Add to Quantity" FIRST before generic "quantity"
        if (lower === "add to quantity" || lower.includes("add to quantity")) {
          return true;
        }
        if (lower === "qty") {
          return true;
        }
        // Only match generic "quantity" if it's NOT "Total Quantity"
        if (lower.includes("quantity") && !lower.includes("total")) {
          return true;
        }
        return false;
      });
      const photoUrlIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes("photo") ||
          h.toLowerCase().includes("image") ||
          h.toLowerCase().includes("url"),
      );
      const priceIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes("price") ||
          h.toLowerCase().includes("market"),
      );

      // Log detected columns for debugging
      console.log("Column Detection:");
      console.log(
        "- Product Name:",
        productNameIndex >= 0 ? headers[productNameIndex] : "NOT FOUND",
      );
      console.log(
        "- Set Name:",
        setNameIndex >= 0 ? headers[setNameIndex] : "NOT FOUND",
      );
      console.log(
        "- Card Number:",
        cardNumberIndex >= 0 ? headers[cardNumberIndex] : "NOT FOUND",
      );
      console.log(
        "- Condition:",
        conditionIndex >= 0 ? headers[conditionIndex] : "NOT FOUND",
      );
      console.log(
        "- Quantity:",
        quantityIndex >= 0 ? headers[quantityIndex] : "NOT FOUND",
      );
      console.log(
        "- Photo URL:",
        photoUrlIndex >= 0 ? headers[photoUrlIndex] : "NOT FOUND",
      );
      console.log(
        "- Price:",
        priceIndex >= 0 ? headers[priceIndex] : "NOT FOUND",
      );

      // Warn if product name not found
      if (productNameIndex === -1) {
        toast.error(
          "Could not find 'Product Name' column in CSV. Please check your file format.",
        );
        console.error("Available headers:", headers);
        setLoading(false);
        return;
      }

      const cards: ParsedCard[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length < 3) continue;

        const card: ParsedCard = {
          productName:
            productNameIndex >= 0 ? values[productNameIndex] : `Card ${i}`,
          setName: setNameIndex >= 0 ? values[setNameIndex] : "Unknown Set",
          cardNumber: cardNumberIndex >= 0 ? values[cardNumberIndex] : "",
          condition:
            conditionIndex >= 0
              ? normalizeCondition(values[conditionIndex])
              : "NM",
          printing: printingIndex >= 0 ? values[printingIndex] : "Normal",
          language: languageIndex >= 0 ? values[languageIndex] : "English",
          quantity:
            quantityIndex >= 0 ? parseInt(values[quantityIndex]) || 1 : 1,
          marketPrice:
            priceIndex >= 0
              ? parseFloat(values[priceIndex].replace("$", "")) || 0
              : 0,
          photoUrl: photoUrlIndex >= 0 ? values[photoUrlIndex] : undefined,
        };

        // Log Franky specifically for debugging
        if (card.productName.toLowerCase().includes("franky")) {
          console.log("🔍 FRANKY DETECTED:");
          console.log("  Line:", lines[i]);
          console.log("  quantityIndex:", quantityIndex);
          console.log("  Raw quantity value:", values[quantityIndex]);
          console.log("  Parsed quantity:", card.quantity);
          console.log("  All values:", values);
        }

        // Log first card for debugging
        if (i === 1) {
          console.log("First parsed card:", {
            productName: card.productName,
            quantity: card.quantity,
            condition: card.condition,
            marketPrice: card.marketPrice,
            photoUrl: card.photoUrl,
          });
        }

        cards.push(card);
      }

      if (cards.length === 0) {
        toast.error("No valid cards found in CSV");
        setLoading(false);
        return;
      }

      setParsedCards(cards);
      toast.success(`Parsed ${cards.length} cards from CSV`);
    } catch (error: any) {
      console.error("Parse error:", error);
      toast.error(`Failed to parse CSV: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const normalizeCondition = (condition: string): string => {
    const c = condition.toUpperCase().trim();
    if (c.includes("NEAR MINT") || c.includes("NM")) return "NM";
    if (c.includes("LIGHT") || c.includes("LP")) return "LP";
    if (c.includes("MODERATE") || c.includes("MP")) return "MP";
    if (c.includes("HEAVY") || c.includes("HP")) return "HP";
    if (c.includes("DAMAGE") || c.includes("DMG")) return "DMG";
    return "NM";
  };

  const generateBatchId = () => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    if (batchName.trim()) {
      // Use custom name + timestamp for uniqueness
      return `TCGPLAYER-${batchName.trim().replace(/\s+/g, "-").toUpperCase()}-${timestamp}`;
    }
    return `TCGPLAYER-${timestamp}`;
  };

  const generateSKU = (
    card: ParsedCard,
    vendorCode?: string,
    acquisitionType?: string,
  ): string => {
    // For consignment with vendor code
    if (vendorCode && card.cardNumber) {
      return `${vendorCode}-${card.cardNumber}`;
    }
    if (vendorCode) {
      const random = Math.floor(100000 + Math.random() * 900000);
      return `${vendorCode}-${random}`;
    }

    // For buy items - add condition to card number
    if (acquisitionType === "buy" && card.cardNumber) {
      return `${card.cardNumber}-${card.condition}`;
    }

    // For buy items without card number
    if (acquisitionType === "buy") {
      const random = Math.floor(100000 + Math.random() * 900000);
      return `CARD-${card.condition}-${random}`;
    }

    // For trade/pull or no card number
    if (card.cardNumber) {
      return card.cardNumber;
    }

    const random = Math.floor(100000 + Math.random() * 900000);
    return `CARD-${random}`;
  };

  const checkForDuplicates = async () => {
    if (parsedCards.length === 0) return;

    try {
      setLoading(true);
      const inventorySnapshot = await getDocs(collection(db, "inventory"));
      const existingCards = inventorySnapshot.docs.map((doc) => ({
        sku: doc.data().sku,
        cardName: doc.data().cardName,
        setName: doc.data().setName,
        cardNumber: doc.data().cardNumber,
      }));

      const foundDuplicates: ParsedCard[] = [];

      // Get customer vendor code ONLY if consignment
      const customer =
        defaultAcquisitionType === "consignment"
          ? customers.find((c) => c.id === selectedCustomerId)
          : null;
      const vendorCode =
        defaultAcquisitionType === "consignment"
          ? customer?.vendorCode || ""
          : "";

      for (const card of parsedCards) {
        const sku = generateSKU(card, vendorCode, defaultAcquisitionType);

        // Check if SKU exists
        const skuExists = existingCards.some(
          (existing) => existing.sku === sku,
        );

        // Check if card name + set exists
        const cardExists = existingCards.some(
          (existing) =>
            existing.cardName?.toLowerCase() ===
              card.productName?.toLowerCase() &&
            existing.setName?.toLowerCase() === card.setName?.toLowerCase(),
        );

        if (skuExists || cardExists) {
          foundDuplicates.push(card);
        }
      }

      setDuplicates(foundDuplicates);

      if (foundDuplicates.length > 0) {
        setShowDuplicateModal(true);
      } else {
        // No duplicates, proceed with import
        proceedWithImport();
      }
    } catch (error: any) {
      console.error("Error checking duplicates:", error);
      toast.error("Error checking for duplicates");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (parsedCards.length === 0) {
      toast.error("No cards to import");
      return;
    }

    if (defaultAcquisitionType === "consignment" && !selectedCustomerId) {
      toast.error("Please select a customer for consignment items");
      return;
    }

    // Check for duplicates first
    await checkForDuplicates();
  };

  const proceedWithImport = async (skipDuplicates: boolean = false) => {
    setShowDuplicateModal(false);

    const cardsToImport = skipDuplicates
      ? parsedCards.filter(
          (card) =>
            !duplicates.some(
              (dup) =>
                dup.productName === card.productName &&
                dup.setName === card.setName,
            ),
        )
      : parsedCards;

    if (cardsToImport.length === 0) {
      toast.error("No cards to import after removing duplicates");
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId);

    const confirmed = confirm(
      `Import ${cardsToImport.length} cards to inventory?\n\n` +
        `Acquisition: ${defaultAcquisitionType}\n` +
        `Location: ${defaultLocation}\n` +
        `Markup: ${defaultMarkup}%\n` +
        (skipDuplicates ? `Skipping ${duplicates.length} duplicates\n` : "") +
        (defaultAcquisitionType === "consignment" && customer
          ? `Customer: ${customer.name}\n`
          : "") +
        `\nAll items will be tagged with a batch ID for easy management.`,
    );

    if (!confirmed) return;

    const batchId = generateBatchId();
    const startTime = new Date().toISOString();
    setCurrentBatchId(batchId);
    setBatchStartTime(startTime);

    setImporting(true);
    setImportProgress(0);

    try {
      console.log(`📦 Starting TCGPlayer import batch: ${batchId}`);
      console.log(`CSV rows: ${cardsToImport.length}`);
      console.log(`Expand quantities: ${expandQuantities ? "YES" : "NO"}`);
      if (expandQuantities) {
        const totalItems = cardsToImport.reduce(
          (sum, card) => sum + (card.quantity || 1),
          0,
        );
        console.log(
          `Total items to create: ${totalItems} (expanded from ${cardsToImport.length} rows)`,
        );
      }
      if (skipDuplicates && duplicates.length > 0) {
        console.log(`Skipping ${duplicates.length} duplicates`);
      }

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < cardsToImport.length; i++) {
        const card = cardsToImport[i];

        try {
          // Use vendor code ONLY for consignment
          const vendorCode =
            defaultAcquisitionType === "consignment"
              ? customer?.vendorCode || ""
              : "";

          // Generate SKU ONCE (same SKU for all copies of this card)
          const sku = generateSKU(card, vendorCode, defaultAcquisitionType);

          const sellPrice = card.marketPrice * (1 + defaultMarkup / 100);

          let costBasis = 0;
          if (defaultAcquisitionType === "buy") {
            costBasis = card.marketPrice * 0.7;
          } else if (defaultAcquisitionType === "trade") {
            costBasis = card.marketPrice * 0.75;
          }

          // Determine how many items to create
          const itemsToCreate = expandQuantities ? card.quantity || 1 : 1;
          const quantityPerItem = expandQuantities ? 1 : card.quantity || 1;

          // Create items (either multiple with qty=1 or one with qty=n)
          // All copies use the SAME SKU
          for (let q = 0; q < itemsToCreate; q++) {
            const inventoryData: any = {
              sku: sku, // ✅ Same SKU for all copies
              cardName: card.productName,
              setName: card.setName,
              cardNumber: card.cardNumber,
              condition: card.condition,
              printing: card.printing,
              language: card.language,
              quantity: quantityPerItem,
              marketPrice: card.marketPrice,
              sellPrice: sellPrice,
              costBasis: costBasis,
              acquisitionType: defaultAcquisitionType,
              location: defaultLocation,
              status: "priced",
              priceSource: "TCGPlayer CSV Import",
              photoUrl: card.photoUrl || null,
              notes: `Imported from TCGPlayer CSV on ${new Date().toLocaleDateString()}`,
              batchId: batchId,
              batchStartTime: startTime,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Log first item being saved for debugging
            if (i === 0 && q === 0) {
              console.log("First item being saved to Firebase:", {
                sku: inventoryData.sku,
                cardName: inventoryData.cardName,
                quantity: inventoryData.quantity,
                photoUrl: inventoryData.photoUrl,
                itemsToCreate: itemsToCreate,
                note:
                  itemsToCreate > 1
                    ? `Creating ${itemsToCreate} items with same SKU`
                    : "Creating 1 item",
              });
            }

            if (defaultAcquisitionType === "consignment" && customer) {
              inventoryData.customerId = selectedCustomerId;
              inventoryData.customerName = customer.name;
              inventoryData.customerVendorCode = customer.vendorCode || "";
              inventoryData.consignorPayoutPercent = 60;
              inventoryData.consignorOwed = sellPrice * 0.6;
              inventoryData.consignorPaid = false;
              inventoryData.consignmentDate = new Date().toISOString();
            }

            await addDoc(collection(db, "inventory"), inventoryData);
            successCount++;
          }

          setImportProgress(Math.round(((i + 1) / cardsToImport.length) * 100));
        } catch (error: any) {
          console.error(`Error importing card ${i + 1}:`, error);
          errorCount++;
        }
      }

      console.log(
        `✅ Import complete: ${successCount} items created, ${errorCount} errors`,
      );
      console.log(`Batch ID: ${batchId}`);

      if (successCount > 0) {
        const message = expandQuantities
          ? `Successfully created ${successCount} items from ${cardsToImport.length} CSV rows!${errorCount > 0 ? ` (${errorCount} errors)` : ""}\n\nBatch: ${batchId}`
          : `Successfully imported ${successCount} items!${errorCount > 0 ? ` (${errorCount} errors)` : ""}\n\nBatch: ${batchId}`;

        toast.success(message);
      } else {
        toast.error("Import failed. Check console for errors.");
      }

      setFile(null);
      setParsedCards([]);
      setImportProgress(0);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-bold">TCGPlayer Import</h1>
            <a
              href="/intake"
              className="inline-flex items-center px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ← Intake
            </a>
            <a
              href="/batches"
              className="inline-flex items-center px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              📦 Manage Batches
            </a>
          </div>
          <p className="text-gray-600">
            Import cards from TCGPlayer CSV export
          </p>

          {currentBatchId && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 inline-block">
              <div className="text-xs text-green-600 font-medium">
                Last Import Batch
              </div>
              <div className="text-sm font-mono font-bold text-green-900">
                {currentBatchId}
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            📋 How to Use
          </h2>
          <ol className="space-y-2 text-sm text-blue-800">
            <li>
              <strong>1.</strong> Export your inventory as CSV from TCGPlayer
            </li>
            <li>
              <strong>2.</strong> Upload the CSV file below
            </li>
            <li>
              <strong>3.</strong> Review the parsed cards
            </li>
            <li>
              <strong>4.</strong> Set acquisition type, location and markup
            </li>
            <li>
              <strong>5.</strong> For consignment: select customer
            </li>
            <li>
              <strong>6.</strong> Click "Import to Inventory"
            </li>
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">1. Upload CSV</h2>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Choose CSV File
                </label>

                {file && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{file.name}</span>
                    <button
                      onClick={() => {
                        setFile(null);
                        setParsedCards([]);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {file && !parsedCards.length && (
                <Button
                  onClick={parseCSV}
                  disabled={loading}
                  className="w-full mt-4"
                  size="lg"
                >
                  {loading ? "Parsing..." : "Parse CSV"}
                </Button>
              )}
            </div>

            {parsedCards.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">
                  2. Preview (
                  {parsedCards.reduce((sum, c) => sum + c.quantity, 0)} cards,{" "}
                  {parsedCards.length} unique items)
                </h2>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {parsedCards.slice(0, 50).map((card, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border text-sm"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{card.productName}</div>
                        <div className="text-xs text-gray-600">
                          {card.setName} • {card.condition}
                          {card.cardNumber && ` • #${card.cardNumber}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          ${card.marketPrice.toFixed(2)}
                        </div>
                        {card.quantity > 1 && (
                          <div className="text-xs text-gray-600">
                            ×{card.quantity}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {parsedCards.length > 50 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      ... and {parsedCards.length - 50} more cards
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4 sticky top-6">
              <h3 className="font-semibold mb-4">Import Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Acquisition Type
                  </label>
                  <select
                    value={defaultAcquisitionType}
                    onChange={(e) =>
                      setDefaultAcquisitionType(e.target.value as any)
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="buy">💰 Buy</option>
                    <option value="trade">🔄 Trade</option>
                    <option value="pull">📦 Pull</option>
                    <option value="consignment">🤝 Consignment</option>
                  </select>
                </div>

                {defaultAcquisitionType === "consignment" && (
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-purple-900">
                        Select Customer *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddCustomerModal(true)}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                      >
                        ➕ Add New
                      </button>
                    </div>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="">-- Select Customer --</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}{" "}
                          {customer.phone && `(${customer.phone})`}
                          {customer.vendorCode && ` [${customer.vendorCode}]`}
                        </option>
                      ))}
                    </select>
                    {!selectedCustomerId && (
                      <p className="text-xs text-purple-600 mt-1">
                        Required for consignment imports
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Default Location
                  </label>
                  <input
                    type="text"
                    value={defaultLocation}
                    onChange={(e) => setDefaultLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="A-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Markup %
                  </label>
                  <input
                    type="number"
                    value={defaultMarkup}
                    onChange={(e) =>
                      setDefaultMarkup(parseFloat(e.target.value) || 30)
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                    max="200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cards will be priced at market + {defaultMarkup}%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Batch Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., ROMANCE-DAWN or WEEKLY-RESTOCK"
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Custom name for this batch (leave empty for auto-generated)
                  </p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="expandQuantities"
                      checked={expandQuantities}
                      onChange={(e) => setExpandQuantities(e.target.checked)}
                      className="mt-1 w-5 h-5"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="expandQuantities"
                        className="font-semibold text-blue-900 cursor-pointer"
                      >
                        Split quantities into separate items
                      </label>
                      <p className="text-sm text-blue-800 mt-1">
                        {expandQuantities ? (
                          <>
                            ✅ <strong>Split Mode:</strong> Quantity 2 → Creates
                            2 separate items (each qty=1). All use the{" "}
                            <strong>same SKU</strong>.
                          </>
                        ) : (
                          <>
                            📦 <strong>Single Item Mode (Default):</strong>{" "}
                            Quantity 2 → Creates 1 item with quantity=2.
                          </>
                        )}
                      </p>
                      <p className="text-xs text-blue-700 mt-2">
                        <strong>Recommended:</strong> Keep unchecked to preserve
                        CSV quantities
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {parsedCards.length > 0 && (
                <>
                  <div className="border-t my-4"></div>

                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      Import Summary
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Cards:</span>
                        <span className="font-bold">
                          {parsedCards.reduce((sum, c) => sum + c.quantity, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unique Items:</span>
                        <span className="font-bold">{parsedCards.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Value:</span>
                        <span className="font-bold text-green-600">
                          $
                          {parsedCards
                            .reduce(
                              (sum, c) => sum + c.marketPrice * c.quantity,
                              0,
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleImport}
                    disabled={importing || loading}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {importing
                      ? `Importing... ${importProgress}%`
                      : loading
                        ? "Checking..."
                        : "Check & Import to Inventory"}
                  </Button>

                  {importing && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${importProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Batch Tracking:</strong> All imported cards will be
                  tagged with a unique batch ID. You can delete the entire
                  import later from the Batches page if needed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Modal */}
      {showDuplicateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDuplicateModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-2 text-orange-600">
              ⚠️ Duplicate Cards Found
            </h2>
            <p className="text-gray-600 mb-6">
              {duplicates.length} card(s) already exist in your inventory. What
              would you like to do?
            </p>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
              <h3 className="font-semibold text-orange-900 mb-3">
                Duplicate Cards:
              </h3>
              <div className="space-y-2">
                {duplicates.map((card, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded p-3 border border-orange-200"
                  >
                    <div className="font-medium text-sm">
                      {card.productName}
                    </div>
                    <div className="text-xs text-gray-600">
                      {card.setName} • {card.condition}
                      {card.cardNumber && ` • #${card.cardNumber}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                type="button"
                onClick={() => proceedWithImport(true)}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                Skip Duplicates & Import{" "}
                {parsedCards.length - duplicates.length} New Cards
              </Button>
              <Button
                type="button"
                onClick={() => proceedWithImport(false)}
                className="bg-orange-600 hover:bg-orange-700"
                size="lg"
              >
                Import All Anyway ({parsedCards.length} cards)
              </Button>
              <Button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                variant="outline"
                size="lg"
              >
                Cancel Import
              </Button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <strong>Tip:</strong> Importing duplicates will create additional
              copies in inventory. Skipping duplicates will only import cards
              that don't already exist.
            </div>
          </div>
        </div>
      )}

      {showAddCustomerModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddCustomerModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-2">➕ Add Customer</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Add a new consignment customer
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  placeholder="555-1234"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  placeholder="john@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Vendor Code
                </label>
                <input
                  type="text"
                  value={newCustomer.vendorCode}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      vendorCode: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="CUST01 (optional)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono uppercase"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional code for this customer's consignments
                </p>
              </div>

              <p className="text-xs text-gray-500">
                * At least phone or email is required
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                onClick={handleAddCustomer}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                Add Customer
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({
                    name: "",
                    phone: "",
                    email: "",
                    vendorCode: "",
                  });
                }}
                variant="outline"
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
