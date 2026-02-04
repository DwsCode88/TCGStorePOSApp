import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface CacheEntry { data: any; expiresAt: Date; createdAt: Date; }

export async function getCachedResponse(key: string): Promise<any | null> {
  try {
    const sanitizedKey = key.replace(/[/\\\.#$\[\]]/g, '_').substring(0, 1500);
    const cacheRef = doc(db, 'priceCache', sanitizedKey);
    const cacheDoc = await getDoc(cacheRef);
    if (!cacheDoc.exists()) return null;
    const entry = cacheDoc.data() as CacheEntry;
    const expiresAt = entry.expiresAt instanceof Date ? entry.expiresAt : (entry.expiresAt as any).toDate();
    if (new Date() > expiresAt) { await deleteDoc(cacheRef); return null; }
    return entry.data;
  } catch (error) { console.error('Cache error:', error); return null; }
}

export async function cacheResponse(key: string, data: any, ttlSeconds: number): Promise<void> {
  try {
    const sanitizedKey = key.replace(/[/\\\.#$\[\]]/g, '_').substring(0, 1500);
    const cacheRef = doc(db, 'priceCache', sanitizedKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    await setDoc(cacheRef, { data, expiresAt, createdAt: now });
  } catch (error) { console.error('Cache write error:', error); }
}
