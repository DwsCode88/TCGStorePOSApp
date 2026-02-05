"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/client";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

export default function QRScanPage() {
  const searchParams = useSearchParams();
  const sku = searchParams.get("sku");

  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [interested, setInterested] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (sku) {
      loadCard();
      trackScan();
    }
  }, [sku]);

  const loadCard = async () => {
    try {
      const cardDoc = await getDoc(doc(db, "inventory", sku!));
      if (cardDoc.exists()) {
        setCard({ id: cardDoc.id, ...cardDoc.data() });
      } else {
        setCard(null);
      }
    } catch (error) {
      console.error("Error loading card:", error);
    } finally {
      setLoading(false);
    }
  };

  const trackScan = async () => {
    try {
      await updateDoc(doc(db, "inventory", sku!), {
        scans: arrayUnion({
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent,
        }),
        scanCount: (card?.scanCount || 0) + 1,
        lastScanned: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error tracking scan:", error);
    }
  };

  const handleInterest = async (isInterested: boolean) => {
    setInterested(isInterested);

    try {
      await updateDoc(doc(db, "inventory", sku!), {
        customerInterest: arrayUnion({
          timestamp: serverTimestamp(),
          interested: isInterested,
          userAgent: navigator.userAgent,
        }),
        interestedCount: isInterested
          ? (card?.interestedCount || 0) + 1
          : card?.interestedCount || 0,
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Error recording interest:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading card...</div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Card Not Found
          </h1>
          <p className="text-gray-600">
            This card may have been sold or is no longer in inventory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Beta Badge */}
        <div className="text-center mb-4">
          <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold inline-block">
            🧪 BETA - Price Checker
          </span>
        </div>

        {/* Card Display */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Card Image */}
          {card.imageUrl && (
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8">
              <img
                src={card.imageUrl}
                alt={card.cardName}
                className="w-full max-w-md mx-auto rounded-xl shadow-lg"
              />
            </div>
          )}

          {/* Card Info */}
          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {card.cardName || card.name}
            </h1>

            <div className="flex items-center gap-2 mb-6">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                {card.setName || card.set}
              </span>
              {card.number && (
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                  #{card.number}
                </span>
              )}
            </div>

            {/* Current Price */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6">
              <div className="text-sm text-gray-600 mb-1">Current Price</div>
              <div className="text-5xl font-bold text-green-600">
                ${(card.sellPrice || 0).toFixed(2)}
              </div>
              {card.lastPriceUpdate && (
                <div className="text-xs text-gray-500 mt-2">
                  Updated:{" "}
                  {new Date(
                    card.lastPriceUpdate.seconds * 1000,
                  ).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Card Details */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <div className="text-gray-600">Condition</div>
                <div className="font-semibold text-gray-800">
                  {card.condition || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Rarity</div>
                <div className="font-semibold text-gray-800">
                  {card.rarity || "N/A"}
                </div>
              </div>
              {card.location && (
                <div className="col-span-2">
                  <div className="text-gray-600">Location</div>
                  <div className="font-semibold text-gray-800">
                    {card.displayLocation || card.location}
                    {card.shelfNumber && ` - Shelf ${card.shelfNumber}`}
                    {card.binderInfo && ` - ${card.binderInfo}`}
                  </div>
                </div>
              )}
            </div>

            {/* Interest Question */}
            {!submitted ? (
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                  Interested in this card?
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleInterest(true)}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    <div className="text-3xl mb-1">✓</div>
                    <div>Yes, I'm Interested!</div>
                  </button>
                  <button
                    onClick={() => handleInterest(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105"
                  >
                    <div className="text-3xl mb-1">✗</div>
                    <div>Just Browsing</div>
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-4">
                  Let us know if you'd like to purchase this card!
                </p>
              </div>
            ) : (
              <div className="border-t border-gray-200 pt-6">
                <div
                  className={`text-center p-6 rounded-xl ${
                    interested
                      ? "bg-green-50 border-2 border-green-200"
                      : "bg-gray-50 border-2 border-gray-200"
                  }`}
                >
                  <div className="text-4xl mb-2">
                    {interested ? "🎉" : "👍"}
                  </div>
                  <div className="text-xl font-semibold text-gray-800 mb-2">
                    {interested
                      ? "Great! Let our staff know you're interested!"
                      : "Thanks for checking out this card!"}
                  </div>
                  <p className="text-sm text-gray-600">
                    {interested
                      ? "Show this to an employee and they'll help you complete your purchase."
                      : "Feel free to scan more cards to check prices!"}
                  </p>
                </div>
              </div>
            )}

            {/* SKU */}
            <div className="mt-6 text-center text-xs text-gray-400">
              SKU: {card.sku || card.id}
            </div>
          </div>
        </div>

        {/* Store Info */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>Prices updated weekly • Scan at checkout for current price</p>
        </div>
      </div>
    </div>
  );
}
