import { getAnalytics, isSupported } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: 'AIzaSyCArxhnyRDSVGFVJSJVAYdA1dBYDm4hdBM',
  authDomain: 'sysstemdelivery.firebaseapp.com',
  projectId: 'sysstemdelivery',
  storageBucket: 'sysstemdelivery.firebasestorage.app',
  messagingSenderId: '991731116135',
  appId: '1:991731116135:web:2cd553815871ec55d80cc2',
  measurementId: 'G-PP0WBMGL5C',
};

export const firebaseApp = initializeApp(firebaseConfig);

export async function initializeFirebaseAnalytics() {
  if (typeof window === 'undefined') return null;
  if (!(await isSupported())) return null;
  return getAnalytics(firebaseApp);
}
