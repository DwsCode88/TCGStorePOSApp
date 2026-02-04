"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase/client";
import { collection, getDocs } from "firebase/firestore";
import QRCode from "qrcode";

interface Card {
  id: string;
  sku: string;
  cardName: string;
  setName: string;
  sellPrice: number;
}

export default function QRCodeGenerator() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        sku: doc.data().sku || doc.id,
        cardName: doc.data().cardName || doc.data().name,
        setName: doc.data().setName || doc.data().set,
        sellPrice: doc.data().sellPrice || 0,
      }));
      setCards(items);
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (sku: string): Promise<string> => {
    const url = `${window.location.origin}/qr-scan?sku=${sku}`;
    return await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  };

  const downloadQRCode = async (card: Card) => {
    const qrDataUrl = await generateQRCode(card.sku);

    const link = document.createElement("a");
    link.download = `QR-${card.sku}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const generateBulkPDF = async () => {
    if (selectedCards.size === 0) {
      alert("Please select cards to generate QR codes");
      return;
    }

    setGeneratingPDF(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();

      const selectedCardData = cards.filter((c) => selectedCards.has(c.id));
      let pageCount = 0;

      for (let i = 0; i < selectedCardData.length; i++) {
        const card = selectedCardData[i];

        if (i > 0 && i % 4 === 0) {
          pdf.addPage();
          pageCount++;
        }

        const qrDataUrl = await generateQRCode(card.sku);

        // Position on page (2x2 grid)
        const col = (i % 4) % 2;
        const row = Math.floor((i % 4) / 2);
        const x = 20 + col * 90;
        const y = 20 + row * 120;

        // Add QR code
        pdf.addImage(qrDataUrl, "PNG", x, y, 60, 60);

        // Add card info
        pdf.setFontSize(10);
        pdf.text(card.cardName, x, y + 65, { maxWidth: 60 });
        pdf.setFontSize(8);
        pdf.text(card.setName, x, y + 75, { maxWidth: 60 });
        pdf.setFontSize(12);
        pdf.setTextColor(0, 128, 0);
        pdf.text(`$${card.sellPrice.toFixed(2)}`, x, y + 85);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(7);
        pdf.text(card.sku, x, y + 92);
      }

      pdf.save(`QR-Codes-${new Date().toISOString().slice(0, 10)}.pdf`);
      alert(`Generated PDF with ${selectedCardData.length} QR codes!`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const filteredCards = cards.filter(
    (card) =>
      card.cardName?.toLowerCase().includes(filter.toLowerCase()) ||
      card.setName?.toLowerCase().includes(filter.toLowerCase()) ||
      card.sku?.toLowerCase().includes(filter.toLowerCase()),
  );

  const toggleSelectCard = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const selectAll = () => {
    setSelectedCards(new Set(filteredCards.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedCards(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                QR Code Generator
              </h1>
              <p className="text-gray-600 mt-2">
                Generate scannable QR codes for price checking
              </p>
            </div>
            <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold">
              🧪 BETA
            </span>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search cards..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
            />
          </div>

          {/* Actions */}
          {selectedCards.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900">
                  {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""}{" "}
                  selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={deselectAll}
                    className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={generateBulkPDF}
                    disabled={generatingPDF}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg"
                  >
                    {generatingPDF ? "⏳ Generating PDF..." : "📄 Generate PDF"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Select All ({filteredCards.length})
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <div className="font-semibold text-blue-900 mb-1">
                How it works:
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Select cards to generate QR codes</li>
                <li>
                  • Download individual codes or bulk PDF (2x2 grid per page)
                </li>
                <li>• Print QR codes and attach to price stickers</li>
                <li>
                  • Customers scan to see current price and express interest
                </li>
                <li>• Track which cards get the most scans!</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCards.map((card) => {
            const isSelected = selectedCards.has(card.id);

            return (
              <div
                key={card.id}
                className={`bg-white rounded-lg shadow p-4 transition-all ${
                  isSelected
                    ? "ring-4 ring-blue-500 bg-blue-50"
                    : "hover:shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-sm mb-1">
                      {card.cardName}
                    </h3>
                    <p className="text-xs text-gray-600">{card.setName}</p>
                    <p className="text-lg font-bold text-green-600 mt-2">
                      ${card.sellPrice.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleSelectCard(card.id)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {isSelected && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => downloadQRCode(card)}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  📥 Download QR
                </button>
              </div>
            );
          })}
        </div>

        {filteredCards.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-xl font-semibold text-gray-800 mb-2">
              No cards found
            </div>
            <div className="text-gray-600">Try adjusting your search</div>
          </div>
        )}
      </div>
    </div>
  );
}
