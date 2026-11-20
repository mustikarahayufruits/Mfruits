import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const APP_ID = 'buahsegar-mobile-prod';

export const INITIAL_SEED_DATA = {
  fruits: [
    { name: 'Sunkist Navel Aust', unit: 'kg', buyPrice: 38000, sellPrice: 48000, stock: 3.5, minStock: 1.5 },
    { name: 'Pear Forelle', unit: 'pax (isi 6)', buyPrice: 32000, sellPrice: 42000, stock: 4, minStock: 2 },
    { name: 'Pir Century', unit: 'kg', buyPrice: 30000, sellPrice: 38000, stock: 4.5, minStock: 2 },
    { name: 'Klengkeng Gold', unit: '500gr', buyPrice: 22000, sellPrice: 28000, stock: 3, minStock: 2 },
    { name: 'Rock Melon', unit: 'kg', buyPrice: 25000, sellPrice: 33000, stock: 2.5, minStock: 1.5 },
    { name: 'NasHon', unit: 'pc', buyPrice: 25000, sellPrice: 33000, stock: 2, minStock: 2 },
    { name: 'Jeruk Santang', unit: 'kg', buyPrice: 28000, sellPrice: 36000, stock: 0, minStock: 1.5 },
    { name: 'Anggur Muscat', unit: '500gr', buyPrice: 35000, sellPrice: 45000, stock: 0, minStock: 2 },
    { name: 'Apel Fuji Premium', unit: 'kg', buyPrice: 34000, sellPrice: 44000, stock: 0, minStock: 1.5 }
  ],
  bankAccounts: [
    { bank: 'BCA', number: '8820192837', holder: 'BuahSegar Store' },
    { bank: 'SeaBank / GoPay', number: '081234567890', holder: 'BuahSegar Store' }
  ]
};

export function getUserCollection(userId, collectionName) {
  return collection(db, 'artifacts', APP_ID, 'users', userId, collectionName);
}

export function getUserDoc(userId, collectionName, docId) {
  return doc(db, 'artifacts', APP_ID, 'users', userId, collectionName, docId);
}

export async function initDatabaseAuth() {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function seedInitialDatabase(userId) {
  const batch = writeBatch(db);
  INITIAL_SEED_DATA.fruits.forEach((item) => {
    const ref = doc(getUserCollection(userId, 'fruits'));
    batch.set(ref, { ...item, updatedAt: new Date().toISOString() });
  });
  INITIAL_SEED_DATA.bankAccounts.forEach((bank) => {
    const ref = doc(getUserCollection(userId, 'bankAccounts'));
    batch.set(ref, bank);
  });
  const capRef = doc(getUserCollection(userId, 'transactions'));
  batch.set(capRef, {
    type: 'capital',
    date: new Date().toISOString().slice(0, 10),
    desc: 'Modal Awal Usaha & Persediaan Rumah',
    amount: 750000
  });
  await batch.commit();
}

export const BuahSegarDB = {
  subscribeAll(userId, callbacks) {
    const unsubs = ['fruits', 'orders', 'bankAccounts', 'transactions'].map((colName) =>
      onSnapshot(getUserCollection(userId, colName), (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (callbacks[colName]) callbacks[colName](data);
      })
    );
    return () => unsubs.forEach((fn) => fn());
  }
};
