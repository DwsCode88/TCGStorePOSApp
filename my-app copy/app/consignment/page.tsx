'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function ConsignmentPage() {
  const [consignmentItems, setConsignmentItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Map<string, any>>(new Map());
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadConsignments = async () => {
      try {
        console.log('🔄 Loading customers...');
        
        // Load all customers first
        let customerMap = new Map();
        try {
          const customersSnapshot = await getDocs(collection(db, 'customers'));
          customersSnapshot.docs.forEach(doc => {
            customerMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
          console.log('✅ Loaded customers:', customerMap.size);
          setCustomers(customerMap);
        } catch (customerError) {
          console.warn('⚠️ Could not load customers (collection may not exist yet):', customerError);
          // Continue without customers
        }
        
        console.log('🔄 Loading consignment items...');
        
        // Load consignment items
        const q = query(
          collection(db, 'inventory'),
          where('acquisitionType', '==', 'consignment')
        );
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('✅ Loaded consignment items:', items.length);
        setConsignmentItems(items);
      } catch (error: any) {
        console.error('❌ Error loading consignments:', error);
        setError(error.message || 'Failed to load consignments');
      } finally {
        console.log('🏁 Loading complete, stopping spinner');
        setLoading(false);
      }
    };
    loadConsignments();
  }, []);

  const activeItems = consignmentItems.filter(i => !i.sold);
  const soldItems = consignmentItems.filter(i => i.sold);
  
  const totalValue = activeItems.reduce((sum, item) => 
    sum + (item.sellPrice || 0), 0
  );
  
  const totalOwed = soldItems
    .filter(i => !i.consignorPaid)
    .reduce((sum, item) => 
      sum + ((item.sellPrice || 0) * ((item.consignorPayoutPercent || 60) / 100)), 0
    );

  const getCustomerName = (customerId: string) => {
    if (!customerId) return 'No Customer';
    const customer = customers.get(customerId);
    return customer ? customer.name : `Unknown (ID: ${customerId.substring(0, 8)})`;
  };

  const getCustomerContact = (customerId: string) => {
    if (!customerId) return '';
    const customer = customers.get(customerId);
    return customer ? (customer.phone || customer.email || '') : '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-lg font-medium mb-2">Loading consignments...</div>
          <div className="text-sm text-gray-500">Check console for details</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Consignments</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-2">Possible fixes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check Firebase connection (console logs)</li>
                <li>Make sure Firestore is enabled in Firebase Console</li>
                <li>Check security rules allow read access</li>
                <li>Verify .env.local has correct Firebase credentials</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🤝 Consignment Tracking</h1>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Active Items</div>
            <div className="text-3xl font-bold text-blue-600">{activeItems.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Value</div>
            <div className="text-3xl font-bold text-green-600">${totalValue.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Sold Items</div>
            <div className="text-3xl font-bold">{soldItems.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Payment Owed</div>
            <div className="text-3xl font-bold text-red-600">${totalOwed.toFixed(2)}</div>
          </div>
        </div>

        {/* Active Consignments */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold">Active Consignments</h2>
            <p className="text-sm text-gray-600 mt-1">Items currently in stock</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-semibold">Card</th>
                  <th className="text-left p-4 font-semibold">Customer</th>
                  <th className="text-left p-4 font-semibold">Contact</th>
                  <th className="text-right p-4 font-semibold">Price</th>
                  <th className="text-right p-4 font-semibold">Their Cut</th>
                  <th className="text-right p-4 font-semibold">Shop Cut</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map(item => {
                  const consignorCut = (item.sellPrice || 0) * ((item.consignorPayoutPercent || 60) / 100);
                  const shopCut = (item.sellPrice || 0) - consignorCut;
                  
                  return (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-semibold">{item.cardName || item.name}</div>
                        <div className="text-sm text-gray-500">{item.setName}</div>
                        <div className="text-xs text-gray-400">
                          {item.condition} • #{item.number}
                        </div>
                      </td>
                      <td className="p-4 font-medium">{getCustomerName(item.customerId)}</td>
                      <td className="p-4 text-sm text-gray-600">{getCustomerContact(item.customerId)}</td>
                      <td className="p-4 text-right font-semibold">
                        ${(item.sellPrice || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-semibold text-purple-600">
                          ${consignorCut.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({item.consignorPayoutPercent || 60}%)
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold text-green-600">
                        ${shopCut.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {activeItems.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-4xl mb-2">📭</div>
                <div>No active consignments</div>
                <div className="text-sm mt-1">Add consignment items from the intake page</div>
              </div>
            )}
          </div>
        </div>

        {/* Sold - Payment Owed */}
        {soldItems.filter(i => !i.consignorPaid).length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b bg-red-50">
              <h2 className="text-2xl font-semibold text-red-900">
                💰 Sold - Payment Owed
              </h2>
              <p className="text-sm text-red-700 mt-1">
                Total owed: ${totalOwed.toFixed(2)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-semibold">Card</th>
                    <th className="text-left p-4 font-semibold">Customer</th>
                    <th className="text-left p-4 font-semibold">Contact</th>
                    <th className="text-right p-4 font-semibold">Sold For</th>
                    <th className="text-right p-4 font-semibold">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {soldItems.filter(i => !i.consignorPaid).map(item => {
                    const owed = (item.sellPrice || 0) * ((item.consignorPayoutPercent || 60) / 100);
                    
                    return (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <div className="font-semibold">{item.cardName || item.name}</div>
                          <div className="text-sm text-gray-500">{item.setName}</div>
                        </td>
                        <td className="p-4 font-semibold">{getCustomerName(item.customerId)}</td>
                        <td className="p-4 text-sm">{getCustomerContact(item.customerId)}</td>
                        <td className="p-4 text-right font-semibold">
                          ${(item.sellPrice || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-bold text-red-600 text-lg">
                          ${owed.toFixed(2)}
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