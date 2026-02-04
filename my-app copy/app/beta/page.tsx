"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, getDocs } from "firebase/firestore";

export default function BetaDashboard() {
  const [stats, setStats] = useState({
    totalCards: 0,
    withLocations: 0,
    totalScans: 0,
    interestedCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const items = snapshot.docs.map((doc) => doc.data());

      const withLocations = items.filter(
        (item) => item.displayLocation || item.shelfNumber || item.binderInfo,
      ).length;

      const totalScans = items.reduce(
        (sum, item) => sum + (item.scanCount || 0),
        0,
      );
      const interestedCustomers = items.reduce(
        (sum, item) => sum + (item.interestedCount || 0),
        0,
      );

      setStats({
        totalCards: items.length,
        withLocations,
        totalScans,
        interestedCustomers,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      title: "Location Management",
      description: "Organize inventory by display, shelf, and binder",
      icon: "📍",
      href: "/beta/locations",
      stats: loading
        ? "..."
        : `${stats.withLocations}/${stats.totalCards} cards organized`,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "QR Code Generator",
      description: "Generate QR codes for customer price checking",
      icon: "🏷️",
      href: "/beta/qr-codes",
      stats: loading ? "..." : `${stats.totalCards} cards ready`,
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "Customer QR Scanner",
      description: "Public page where customers scan cards",
      icon: "📱",
      href: "/qr-scan?sku=DEMO",
      stats: loading ? "..." : `${stats.totalScans} total scans`,
      color: "from-green-500 to-green-600",
      external: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                BETA Features
              </h1>
              <p className="text-gray-600 mt-1">
                Experimental tools for inventory management
              </p>
            </div>
            <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold">
              🧪 BETA
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? "..." : stats.totalCards}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Cards</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="text-3xl mb-2">📍</div>
            <div className="text-3xl font-bold text-blue-600">
              {loading ? "..." : stats.withLocations}
            </div>
            <div className="text-sm text-gray-600 mt-1">With Locations</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="text-3xl mb-2">👁️</div>
            <div className="text-3xl font-bold text-purple-600">
              {loading ? "..." : stats.totalScans}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Scans</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="text-3xl mb-2">❤️</div>
            <div className="text-3xl font-bold text-green-600">
              {loading ? "..." : stats.interestedCustomers}
            </div>
            <div className="text-sm text-gray-600 mt-1">Customer Interest</div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Link
              key={index}
              href={feature.href}
              className="group block"
              target={feature.external ? "_blank" : undefined}
            >
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 h-full">
                {/* Gradient Header */}
                <div
                  className={`bg-gradient-to-r ${feature.color} p-6 text-white`}
                >
                  <div className="text-5xl mb-3">{feature.icon}</div>
                  <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-500">
                      {feature.stats}
                    </div>
                    <div className="text-blue-600 group-hover:translate-x-1 transition-transform">
                      →
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">ℹ️</div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                About BETA Features
              </h3>
              <div className="text-blue-800 space-y-2 text-sm">
                <p>
                  These features are currently in beta testing. They're fully
                  functional but may receive updates and improvements based on
                  your feedback.
                </p>
                <p className="font-semibold">What's included:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Location tracking for inventory organization</li>
                  <li>QR code generation for customer price checking</li>
                  <li>Customer interest tracking and analytics</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <Link
            href="/inventory"
            className="bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl p-6 text-center transition-all"
          >
            <div className="text-3xl mb-2">📊</div>
            <div className="font-semibold text-gray-900">View Inventory</div>
            <div className="text-sm text-gray-600 mt-1">Manage your cards</div>
          </Link>

          <Link
            href="/intake"
            className="bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl p-6 text-center transition-all"
          >
            <div className="text-3xl mb-2">➕</div>
            <div className="font-semibold text-gray-900">Add Cards</div>
            <div className="text-sm text-gray-600 mt-1">
              Intake new inventory
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
