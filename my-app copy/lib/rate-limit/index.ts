import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface RateLimitState {
  requestCount: number;
  resetDate: Date;
  plan: 'hobby' | 'pro' | 'enterprise';
  limit: number;
}

const PLAN_LIMITS = { hobby: 1000, pro: 10000, enterprise: 100000 };

export async function canMakeRequest(): Promise<boolean> {
  const stateRef = doc(db, 'systemConfig', 'rateLimitState');
  const stateDoc = await getDoc(stateRef);
  if (!stateDoc.exists()) {
    await setDoc(stateRef, { requestCount: 0, resetDate: getMonthEnd(), plan: 'pro', limit: PLAN_LIMITS.pro });
    return true;
  }
  const state = stateDoc.data() as RateLimitState;
  const resetDate = state.resetDate instanceof Date ? state.resetDate : (state.resetDate as any).toDate();
  if (new Date() > resetDate) {
    await updateDoc(stateRef, { requestCount: 0, resetDate: getMonthEnd() });
    return true;
  }
  return state.requestCount < state.limit * 0.9;
}

export async function incrementRequestCount(count: number = 1): Promise<void> {
  const stateRef = doc(db, 'systemConfig', 'rateLimitState');
  const stateDoc = await getDoc(stateRef);
  if (stateDoc.exists()) {
    const currentCount = stateDoc.data().requestCount || 0;
    await updateDoc(stateRef, { requestCount: currentCount + count });
  }
}

function getMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}
