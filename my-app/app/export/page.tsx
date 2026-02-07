'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';

interface InventoryItem {
  id: string;
  sku: string;
  cardName: string;
  setName: string;
  game: string;
  printing?: string;
  condition?: string;
  notes?: string;
  sellPrice?: number;
  costBasis?: number;
  quantity?: number;
  location?: string;
  acquisitionType?: string;
  customerId?: string;
  customerVendorCode?: string;
}

export default function ExportPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setItems(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIDs = (item: InventoryItem): string => {
    const game = (item.game || '').toLowerCase();
    const categories: string[] = ['683']; // Single Cards (Main)
    
    // Check if graded
    const isGraded = 
      item.condition?.toLowerCase().includes('graded') ||
      item.notes?.toLowerCase().includes('graded') ||
      item.printing?.toLowerCase().includes('graded');

    // Game-specific categories
    if (game.includes('one piece')) {
      categories.push('684'); // One Piece SUB
      if (isGraded) {
        categories.push('687'); // Graded Cards SUB
      }
    } else if (game.includes('pokemon')) {
      categories.push('686'); // Pokemon SUB
      if (isGraded) {
        categories.push('688'); // Graded Cards SUB
      }
    }

    return categories.join(',');
  };

  const exportToCSV = () => {
    const selectedItems = items.filter(item => selected.has(item.id));
    
    if (selectedItems.length === 0) {
      alert('Please select at least one item to export');
      return;
    }

    console.log(`📤 Exporting ${selectedItems.length} items to CSV...`);

    // Count consignment items
    const consignmentItems = selectedItems.filter(item => 
      item.acquisitionType?.toLowerCase() === 'consignment'
    );
    console.log(`🤝 Found ${consignmentItems.length} consignment items`);
    consignmentItems.forEach(item => {
      if (item.customerVendorCode) {
        console.log(`  - ${item.cardName}: Vendor Code = ${item.customerVendorCode}`);
      }
    });

    // CSV Headers (36 columns)
    const headers = [
      'Category IDs',
      'Dept Code',
      'Status',
      'Product Title',
      'Short Description',
      'Unit of Measurement',
      'Availability',
      'Unlimited Inventory',
      'Options',
      'Assigned option values',
      'sku',
      'upc',
      'Manufacturer Product Id',
      'Alternate Lookups',
      'Manufacturer',
      'Primary Vendor',
      'Serial Number',
      'Store Location ID',
      'Weight',
      'Default Cost',
      'Price',
      'Sale Price',
      'Wholesale Price',
      'MAP Price',
      'Wholesale Description',
      'Cost',
      'Inventory',
      'Re-Order Point',
      'Desired Stock Level',
      'Case Unit Qty',
      'Retail Unit Type',
      'Case Unit Type',
      'Tax Code',
      'Vendor Consignment',
      'Alt Barcode Title',
      'Bin Location'
    ];

    // Build rows
    const rows = selectedItems.map(item => {
      const title = `${item.cardName}${item.setName ? ' - ' + item.setName : ''}`;
      const description = [item.game, item.printing, item.condition]
        .filter(Boolean)
        .join(' | ');

      // Determine vendor and consignment status
      const isConsignment = item.acquisitionType?.toLowerCase() === 'consignment';
      const primaryVendor = isConsignment && item.customerVendorCode 
        ? item.customerVendorCode 
        : '5325102';
      const vendorConsignment = isConsignment ? 'yes' : 'no';

      return [
        getCategoryIDs(item),            // Category IDs (comma-separated)
        '',                              // Dept Code
        'active',                        // Status
        title,                           // Product Title
        description,                     // Short Description
        'each',                          // Unit of Measurement
        'both',                          // Availability
        'no',                            // Unlimited Inventory
        '',                              // Options
        '',                              // Assigned option values
        item.sku,                        // sku
        '',                              // upc
        '',                              // Manufacturer Product Id
        '',                              // Alternate Lookups
        '',                              // Manufacturer
        primaryVendor,                   // Primary Vendor (5325102 or customer code)
        '',                              // Serial Number
        item.location || '',             // Store Location ID
        '',                              // Weight
        (item.costBasis || 0).toFixed(2), // Default Cost
        (item.sellPrice || 0).toFixed(2), // Price
        '',                              // Sale Price
        '',                              // Wholesale Price
        '',                              // MAP Price
        '',                              // Wholesale Description
        (item.costBasis || 0).toFixed(2), // Cost
        (item.quantity || 1).toString(), // Inventory
        '',                              // Re-Order Point
        '',                              // Desired Stock Level
        '',                              // Case Unit Qty
        'items',                         // Retail Unit Type
        '',                              // Case Unit Type
        '',                              // Tax Code
        vendorConsignment,               // Vendor Consignment
        '',                              // Alt Barcode Title
        item.location || ''              // Bin Location
      ];
    });

    // Convert to CSV
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(','))
      .join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `vaulttrove-batch-${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV export complete!');
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(item => item.id)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Export to POS (36 Columns)</h1>
          
          <div className="flex gap-4 items-center mb-4">
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {selected.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            
            <button
              onClick={exportToCSV}
              disabled={selected.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              Export {selected.size} Items
            </button>

            <div className="text-sm text-gray-600">
              {items.length} total items | {selected.size} selected
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            <p><strong>Format:</strong> 36 columns, POS-compatible</p>
            <p><strong>Category IDs:</strong> Pokemon = 683,686 | One Piece = 683,684</p>
            <p><strong>Vendor:</strong> 5325102 (or customer code for consignment)</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">Card</th>
                <th className="p-3 text-left">Set</th>
                <th className="p-3 text-left">Game</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Qty</th>
                <th className="p-3 text-left">Type</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr 
                  key={item.id}
                  className={`border-b hover:bg-gray-50 ${selected.has(item.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className="p-3 text-sm font-mono">{item.sku}</td>
                  <td className="p-3">{item.cardName}</td>
                  <td className="p-3 text-sm text-gray-600">{item.setName}</td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {item.game}
                    </span>
                  </td>
                  <td className="p-3">${(item.sellPrice || 0).toFixed(2)}</td>
                  <td className="p-3">{item.quantity || 1}</td>
                  <td className="p-3 text-xs">
                    {item.acquisitionType === 'consignment' ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                        {item.customerVendorCode || 'CONSIGN'}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        5325102
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}