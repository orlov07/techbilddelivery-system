import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyAO8xUBmNc9NREHS0qPAHNv8VN_JFYL7ts',
  authDomain: 'techbilddelivery.firebaseapp.com',
  projectId: 'techbilddelivery',
  storageBucket: 'techbilddelivery.firebasestorage.app',
  messagingSenderId: '824716406777',
  appId: '1:824716406777:web:cf9bd3fe2b7c39837c5728',
  measurementId: 'G-42C4Q6J6Q5',
};

export const firebaseApp = initializeApp(firebaseConfig);

export let firebaseAnalytics: Analytics | null = null;

void isSupported().then((supported) => {
  if (supported) {
    firebaseAnalytics = getAnalytics(firebaseApp);
  }
}).catch(() => {
  firebaseAnalytics = null;
});
