"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addDoc, collection } from "firebase/firestore";
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
  
  // Default settings
  const [defaultLocation, setDefaultLocation] = useState("A-1");
  const [defaultMarkup, setDefaultMarkup] = useState(30); // 30% markup
  const [defaultAcquisitionType, setDefaultAcquisitionType] = useState<"buy" | "trade" | "pull">("buy");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
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
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        setLoading(false);
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Common TCGPlayer CSV headers
      const productNameIndex = headers.findIndex(h => 
        h.toLowerCase().includes('product') || h.toLowerCase().includes('name')
      );
      const setNameIndex = headers.findIndex(h => 
        h.toLowerCase().includes('set') || h.toLowerCase().includes('edition')
      );
      const cardNumberIndex = headers.findIndex(h => 
        h.toLowerCase().includes('number') || h.toLowerCase() === 'card #'
      );
      const conditionIndex = headers.findIndex(h => 
        h.toLowerCase().includes('condition')
      );
      const printingIndex = headers.findIndex(h => 
        h.toLowerCase().includes('printing') || h.toLowerCase().includes('finish')
      );
      const languageIndex = headers.findIndex(h => 
        h.toLowerCase().includes('language')
      );
      const quantityIndex = headers.findIndex(h => 
        h.toLowerCase().includes('quantity') || h.toLowerCase() === 'qty'
      );
      const priceIndex = headers.findIndex(h => 
        h.toLowerCase().includes('price') || h.toLowerCase().includes('market')
      );

      const cards: ParsedCard[] = [];

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length < 3) continue; // Skip invalid rows

        const card: ParsedCard = {
          productName: productNameIndex >= 0 ? values[productNameIndex] : `Card ${i}`,
          setName: setNameIndex >= 0 ? values[setNameIndex] : "Unknown Set",
          cardNumber: cardNumberIndex >= 0 ? values[cardNumberIndex] : "",
          condition: conditionIndex >= 0 ? normalizeCondition(values[conditionIndex]) : "NM",
          printing: printingIndex >= 0 ? values[printingIndex] : "Normal",
          language: languageIndex >= 0 ? values[languageIndex] : "English",
          quantity: quantityIndex >= 0 ? parseInt(values[quantityIndex]) || 1 : 1,
          marketPrice: priceIndex >= 0 ? parseFloat(values[priceIndex].replace('$', '')) || 0 : 0,
        };

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
    if (c.includes('NEAR MINT') || c.includes('NM')) return 'NM';
    if (c.includes('LIGHT') || c.includes('LP')) return 'LP';
    if (c.includes('MODERATE') || c.includes('MP')) return 'MP';
    if (c.includes('HEAVY') || c.includes('HP')) return 'HP';
    if (c.includes('DAMAGE') || c.includes('DMG')) return 'DMG';
    return 'NM';
  };

  const generateBatchId = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `TCGPLAYER-${timestamp}`;
  };

  const generateSKU = (card: ParsedCard): string => {
    if (card.cardNumber) {
      return card.cardNumber;
    }
    
    // Fallback to random SKU
    const random = Math.floor(100000 + Math.random() * 900000);
    return `CARD-${random}`;
  };

  const handleImport = async () => {
    if (parsedCards.length === 0) {
      toast.error("No cards to import");
      return;
    }

    const confirmed = confirm(
      `Import ${parsedCards.length} cards to inventory?\n\n` +
      `Acquisition: ${defaultAcquisitionType}\n` +
      `Location: ${defaultLocation}\n` +
      `Markup: ${defaultMarkup}%\n\n` +
      `All items will be tagged with a batch ID for easy management.`
    );

    if (!confirmed) return;

    // Generate batch ID
    const batchId = generateBatchId();
    const startTime = new Date().toISOString();
    setCurrentBatchId(batchId);
    setBatchStartTime(startTime);

    setImporting(true);
    setImportProgress(0);

    try {
      console.log(`📦 Starting TCGPlayer import batch: ${batchId}`);
      console.log(`Total items: ${parsedCards.length}`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < parsedCards.length; i++) {
        const card = parsedCards[i];
        
        try {
          const sku = generateSKU(card);
          const sellPrice = card.marketPrice * (1 + defaultMarkup / 100);
          
          // Calculate cost basis based on acquisition type
          let costBasis = 0;
          if (defaultAcquisitionType === "buy") {
            costBasis = card.marketPrice * 0.70; // 70% for NM
          } else if (defaultAcquisitionType === "trade") {
            costBasis = card.marketPrice * 0.75; // 75% for trades
          }

          const inventoryData = {
            sku: sku,
            cardName: card.productName,
            setName: card.setName,
            cardNumber: card.cardNumber,
            condition: card.condition,
            printing: card.printing,
            language: card.language,
            quantity: card.quantity,
            marketPrice: card.marketPrice,
            sellPrice: sellPrice,
            costBasis: costBasis,
            acquisitionType: defaultAcquisitionType,
            location: defaultLocation,
            status: "priced",
            priceSource: "TCGPlayer CSV Import",
            notes: `Imported from TCGPlayer CSV on ${new Date().toLocaleDateString()}`,
            batchId: batchId,  // ✅ Batch tracking
            batchStartTime: startTime,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await addDoc(collection(db, "inventory"), inventoryData);
          successCount++;
          
          setImportProgress(Math.round(((i + 1) / parsedCards.length) * 100));
        } catch (error: any) {
          console.error(`Error importing card ${i + 1}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Import complete: ${successCount} success, ${errorCount} errors`);
      console.log(`Batch ID: ${batchId}`);

      if (successCount > 0) {
        toast.success(
          `Successfully imported ${successCount} cards!${errorCount > 0 ? ` (${errorCount} errors)` : ''}\n\nBatch: ${batchId}`
        );
      } else {
        toast.error("Import failed. Check console for errors.");
      }

      // Reset form
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
        {/* Header */}
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
          <p className="text-gray-600">Import cards from TCGPlayer CSV export</p>

          {currentBatchId && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 inline-block">
              <div className="text-xs text-green-600 font-medium">Last Import Batch</div>
              <div className="text-sm font-mono font-bold text-green-900">{currentBatchId}</div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">📋 How to Use</h2>
          <ol className="space-y-2 text-sm text-blue-800">
            <li><strong>1.</strong> Export your inventory as CSV from TCGPlayer</li>
            <li><strong>2.</strong> Upload the CSV file below</li>
            <li><strong>3.</strong> Review the parsed cards</li>
            <li><strong>4.</strong> Set default location and markup</li>
            <li><strong>5.</strong> Click "Import to Inventory"</li>
            <li><strong>6.</strong> All items will be tagged with a batch ID - you can delete the entire batch later if needed</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload */}
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

            {/* Preview */}
            {parsedCards.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">
                  2. Preview ({parsedCards.length} cards)
                </h2>
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {parsedCards.slice(0, 50).map((card, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded border text-sm">
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
                          <div className="text-xs text-gray-600">×{card.quantity}</div>
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

          {/* Right Column - Settings */}
          <div className="space-y-4">
            {/* Settings */}
            <div className="bg-white rounded-lg shadow p-4 sticky top-6">
              <h3 className="font-semibold mb-4">Import Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Acquisition Type</label>
                  <select
                    value={defaultAcquisitionType}
                    onChange={(e) => setDefaultAcquisitionType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="buy">💰 Buy</option>
                    <option value="trade">🔄 Trade</option>
                    <option value="pull">📦 Pull</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Location</label>
                  <input
                    type="text"
                    value={defaultLocation}
                    onChange={(e) => setDefaultLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="A-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Markup %</label>
                  <input
                    type="number"
                    value={defaultMarkup}
                    onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 30)}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                    max="200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cards will be priced at market + {defaultMarkup}%
                  </p>
                </div>
              </div>

              {parsedCards.length > 0 && (
                <>
                  <div className="border-t my-4"></div>
                  
                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Import Summary</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Cards:</span>
                        <span className="font-bold">{parsedCards.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Value:</span>
                        <span className="font-bold text-green-600">
                          ${parsedCards.reduce((sum, c) => sum + (c.marketPrice * c.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {importing ? `Importing... ${importProgress}%` : "Import to Inventory"}
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

            {/* Help */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Batch Tracking:</strong> All imported cards will be tagged with a unique batch ID. You can delete the entire import later from the Batches page if needed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}