import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

// ============================================================================
// 1. KONFIGURASI FIREBASE & DAFTAR EMAIL YANG DIIZINKAN (WHITELIST)
// ============================================================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const ALLOWED_EMAILS = [
  'mustikarahayufruits@gmail.com'
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const APP_ID = 'buahsegar-mobile-v1';
const UNIT_OPTIONS = ['kg', 'pack', '500gr', 'pcs', 'box', 'ikat'];

// ============================================================================
// 2. HELPER TANGGAL, FORMAT RUPIAH, KONVERSI GRAM & FILTER PERIODE
// ============================================================================
function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatRp(num) {
  return 'Rp ' + Math.round(Number(num || 0)).toLocaleString('id-ID');
}

function formatWeightDetail(qty, unit) {
  const val = Number(qty || 0);
  if ((unit || '').toLowerCase() !== 'kg' || val <= 0) return '';
  const totalGrams = Math.round(val * 1000);
  const kgPart = Math.floor(totalGrams / 1000);
  const grPart = totalGrams % 1000;
  if (kgPart === 0) return `= ${grPart.toLocaleString('id-ID')} gram`;
  if (grPart === 0) return `= ${kgPart} kg pas (${totalGrams.toLocaleString('id-ID')} gr)`;
  return `= ${kgPart} kg ${grPart} gr (${totalGrams.toLocaleString('id-ID')} gr)`;
}

function isDateInPeriod(dateStr, period) {
  if (period === 'all' || !dateStr) return true;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return d.getTime() === today.getTime();
  if (period === '7d') {
    const diff = (today - d) / 86400000;
    return diff >= 0 && diff <= 7;
  }
  if (period === 'month') {
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }
  return true;
}

// ============================================================================
// TEMA FRESH: MODE TERANG & MODE GELAP
// ============================================================================
const FRESH_MODES = {
  light: {
    '--bg-outer': '#e2e8f0',
    '--bg-app': '#f8fafc',
    '--bg-card': '#ffffff',
    '--bg-card-sub': '#f1f5f9',
    '--text-main': '#0f172a',
    '--text-muted': '#64748b',
    '--border-color': '#e2e8f0',
    '--accent': '#059669',
    '--accent-soft': '#ecfdf5',
    '--accent-text': '#047857',
    '--header-grad': 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    '--nav-bg': 'rgba(255, 255, 255, 0.96)'
  },
  dark: {
    '--bg-outer': '#060a10',
    '--bg-app': '#0b111a',
    '--bg-card': '#131c2a',
    '--bg-card-sub': '#1d293b',
    '--text-main': '#f1f5f9',
    '--text-muted': '#94a3b8',
    '--border-color': '#233146',
    '--accent': '#10b981',
    '--accent-soft': 'rgba(16, 185, 129, 0.16)',
    '--accent-text': '#34d399',
    '--header-grad': 'linear-gradient(135deg, #064e3b 0%, #115e59 100%)',
    '--nav-bg': 'rgba(19, 28, 42, 0.96)'
  }
};

// ============================================================================
// LOGO MFRUITS (OPSI 1B) & IKON NAVIGASI
// ============================================================================
function MFruitsLogo({ sizeClass = 'w-12 h-12 rounded-2xl p-1.5' }) {
  return (
    <div className={`${sizeClass} bg-[#d1fae5] flex items-center justify-center shadow-md shrink-0 overflow-hidden border border-white/40`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16 74V36C16 24 25 18 34 25L50 38L66 25C75 18 84 24 84 36V74"
          stroke="#065f46"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 74V36C16 24 25 18 34 25L50 38L66 25C75 18 84 24 84 36V74"
          stroke="#10b981"
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 74V52C20 44 27 42 33 46M67 46C73 42 80 44 84 52V74"
          stroke="#facc15"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M50 44C50 33 59 27 68 29C67 38 59 44 50 44Z"
          fill="#16a34a"
          stroke="#065f46"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M52 42L63 32" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M50 48C43 44 33 48 33 59C33 71 41 81 50 79C59 81 67 71 67 59C67 48 57 44 50 48Z"
          fill="#dc2626"
          stroke="#7f1d1d"
          strokeWidth="2.5"
        />
        <path
          d="M50 51C45 48 37 51 37 59C37 68 43 76 50 74.5C57 76 63 68 63 59C63 51 55 48 50 51Z"
          fill="#fefce8"
        />
        <ellipse cx="46.5" cy="62" rx="1.6" ry="2.8" transform="rotate(-15 46.5 62)" fill="#78350f" />
        <ellipse cx="53.5" cy="62" rx="1.6" ry="2.8" transform="rotate(15 53.5 62)" fill="#78350f" />
      </svg>
    </div>
  );
}

function NavIcon({ id }) {
  switch (id) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V19a1 1 0 001 1h12a1 1 0 001-1V9.5" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'stock':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
          <path d="M3.3 8.2L12 13l8.7-4.8" />
          <path d="M12 13v8" />
        </svg>
      );
    case 'orders':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7h12l1 12H5L6 7z" />
          <path d="M9 7V5a3 3 0 016 0v2" />
        </svg>
      );
    case 'receivables':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="M16 12.5h.01" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'finance':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V8" />
          <path d="M17 16v-8" />
        </svg>
      );
    default:
      return null;
  }
}

// ============================================================================
// 3. KOMPONEN UTAMA APLIKASI MFRUITS
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [dbError, setDbError] = useState('');

  // Firestore collections
  const [fruits, setFruits] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Mode Terang / Gelap
  const [colorMode, setColorMode] = useState(() => {
    try {
      return localStorage.getItem('mfruits_fresh_mode') || 'light';
    } catch {
      return 'light';
    }
  });

  const handleToggleColorMode = () => {
    const nextMode = colorMode === 'light' ? 'dark' : 'light';
    setColorMode(nextMode);
    try {
      localStorage.setItem('mfruits_fresh_mode', nextMode);
    } catch {}
  };

  // UI states
  const [currentView, setCurrentView] = useState('home');
  const [stockFilter, setStockFilter] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [financeSubTab, setFinanceSubTab] = useState('sales');
  const [financePeriods, setFinancePeriods] = useState({
    sales: 'all',
    pnl: 'all',
    balance: 'all',
    cashflow: 'all'
  });
  const [toastMsg, setToastMsg] = useState('');

  // Modal Tambah/Edit Buah
  const [fruitModalOpen, setFruitModalOpen] = useState(false);
  const [fruitForm, setFruitForm] = useState({
    id: '',
    name: '',
    unit: 'kg',
    stock: 0,
    buyPrice: '',
    sellPrice: '',
    minStock: 1,
    stockSource: 'capital' // 'capital' (Modal Disetor Awal) | 'cash' (Beli dari Kas Toko)
  });

  // Modal Tambah/Edit Master Paket Bundling
  const [bundleCatalogModalOpen, setBundleCatalogModalOpen] = useState(false);
  const [bundleCatalogForm, setBundleCatalogForm] = useState({
    id: '',
    name: '',
    sellPrice: '',
    desc: '',
    items: []
  });

  // Modal Belanja Stok Multi-Item
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(getTodayDateStr());
  const [bulkNote, setBulkNote] = useState('');
  const [bulkPayMethod, setBulkPayMethod] = useState('cash');
  const [bulkRows, setBulkRows] = useState([]);

  // Modal Out Stock Non-Penjualan
  const [outStockModalOpen, setOutStockModalOpen] = useState(false);
  const [outStockForm, setOutStockForm] = useState({
    fruitId: '',
    qty: '',
    reason: 'Buah Busuk / Rusak',
    date: getTodayDateStr(),
    note: ''
  });

  // Modal Order (Order Satuan Multi-Buah vs Order Bundling dari Katalog)
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [orderMode, setOrderMode] = useState('single');
  const [orderCustomer, setOrderCustomer] = useState('');
  const [orderStatus, setOrderStatus] = useState('confirmed');
  const [orderCustomSell, setOrderCustomSell] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [singleOrderItems, setSingleOrderItems] = useState([]);
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [bundleOrderQty, setBundleOrderQty] = useState(1);

  // Modal Selesaikan Order + Metode Bayar (Transfer / Cash)
  const [completeOrderTarget, setCompleteOrderTarget] = useState(null);
  const [completeDate, setCompleteDate] = useState(getTodayDateStr());
  const [completePayMethod, setCompletePayMethod] = useState('transfer');

  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ bank: '', number: '', holder: '' });

  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  const [financeForm, setFinanceForm] = useState({ id: '', type: 'opex', date: getTodayDateStr(), desc: '', amount: '', payMethod: 'cash' });

  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3200);
  };

  const copyTextSafe = (text, msg) => {
    navigator.clipboard?.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    showToast(msg || 'Tersalin!');
  };

  // ==========================================================================
  // 4. FIREBASE AUTH WHITELIST (HANYA EMAIL TERDAFTAR YANG BISA MASUK)
  // ==========================================================================
  const isEmailAuthorized = (email) => {
    if (!email) return false;
    return ALLOWED_EMAILS.map((e) => e.trim().toLowerCase()).includes(email.trim().toLowerCase());
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u && u.email && isEmailAuthorized(u.email)) {
        setUser(u);
        setAuthError('');
      } else if (u) {
        const rejectedEmail = u.email || 'Akun Tamu';
        await signOut(auth);
        setUser(null);
        setAuthError(`Akses ditolak: Email (${rejectedEmail}) tidak terdaftar di sistem MFruits.`);
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    });
    return () => unsubAuth();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const email = res.user?.email || '';
      if (!isEmailAuthorized(email)) {
        await signOut(auth);
        setUser(null);
        setAuthError(`Akses ditolak: Email (${email}) tidak terdaftar. Hubungi admin MFruits.`);
      }
    } catch (err) {
      setAuthError('Gagal masuk dengan Google: ' + err.message);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await signOut(auth);
      setAccountModalOpen(false);
      setUser(null);
    } catch (err) {
      showToast(err.message);
    }
  };

  // ==========================================================================
  // 5. REALTIME LISTENERS FIRESTORE
  // ==========================================================================
  useEffect(() => {
    if (!user) return;
    const base = `artifacts/${APP_ID}/users/mfruits_store`;

    const unsubFruits = onSnapshot(
      collection(db, `${base}/fruits`),
      (snap) => {
        setFruits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setDbError('');
      },
      (err) => setDbError('Izin Firestore ditolak: ' + err.message)
    );

    const unsubBundles = onSnapshot(collection(db, `${base}/bundles`), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBundles(list);
    });

    const unsubOrders = onSnapshot(collection(db, `${base}/orders`), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(list);
    });

    const unsubBanks = onSnapshot(collection(db, `${base}/bankAccounts`), (snap) => {
      setBankAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubTrx = onSnapshot(collection(db, `${base}/transactions`), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTransactions(list);
    });

    return () => {
      unsubFruits();
      unsubBundles();
      unsubOrders();
      unsubBanks();
      unsubTrx();
    };
  }, [user]);

  const storeDoc = (colName, id) => doc(db, `artifacts/${APP_ID}/users/mfruits_store/${colName}`, id);

  // ==========================================================================
  // 6. KALKULASI METRIK UTAMA
  // ==========================================================================
  const metrics = useMemo(() => {
    const inventoryValue = fruits.reduce((s, f) => s + Number(f.stock || 0) * Number(f.buyPrice || 0), 0);
    const lowStockItems = fruits.filter((f) => Number(f.stock || 0) <= Number(f.minStock || 0));

    const demandMap = {};
    orders
      .filter((o) => o.status !== 'completed')
      .forEach((o) => {
        (o.items || []).forEach((it) => {
          const key = `${(it.fruitName || '').trim().toLowerCase()}|${(it.unit || '').trim().toLowerCase()}`;
          if (!demandMap[key]) demandMap[key] = { fruitName: it.fruitName, unit: it.unit, needed: 0 };
          demandMap[key].needed = Number((demandMap[key].needed + Number(it.qty || 0)).toFixed(3));
        });
      });

    const shoppingList = Object.values(demandMap)
      .map((d) => {
        const fruit =
          fruits.find(
            (f) =>
              f.name.trim().toLowerCase() === d.fruitName.trim().toLowerCase() &&
              (f.unit || '').trim().toLowerCase() === (d.unit || '').trim().toLowerCase()
          ) || fruits.find((f) => f.name.trim().toLowerCase() === d.fruitName.trim().toLowerCase());
        const stock = fruit ? Number(fruit.stock) : 0;
        const buyPrice = fruit ? Number(fruit.buyPrice) : 0;
        const deficit = Math.max(0, Number((d.needed - stock).toFixed(3)));
        return {
          fruitId: fruit ? fruit.id : null,
          fruitName: d.fruitName,
          unit: d.unit,
          needed: d.needed,
          stock,
          deficit,
          buyPrice,
          estCost: deficit * buyPrice
        };
      })
      .filter((item) => item.deficit > 0);

    const totalShoppingCost = shoppingList.reduce((s, item) => s + item.estCost, 0);

    const allSales = transactions.filter((t) => t.type === 'sale');
    const allOpex = transactions.filter((t) => t.type === 'opex');
    const allStockOut = transactions.filter((t) => t.type === 'stock_out');
    const allReval = transactions.filter((t) => t.type === 'revaluation');
    const totalRev = allSales.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalHpp = allSales.reduce((s, t) => s + Number(t.costAmount || 0), 0);
    const totalOpex = allOpex.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalLoss = allStockOut.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalReval = allReval.reduce((s, t) => s + Number(t.amount || 0), 0);
    const netProfitAll = totalRev - totalHpp - totalOpex - totalLoss + totalReval;

    return { inventoryValue, lowStockItems, shoppingList, totalShoppingCost, netProfitAll };
  }, [fruits, orders, transactions]);

  // ==========================================================================
  // 7. AKSI STOK, KATALOG BUNDLING, BELANJA & OUT STOCK
  // ==========================================================================
  const adjustStock = async (fruitId, delta, recordPurchase) => {
    const f = fruits.find((item) => item.id === fruitId);
    if (!f || !user) return;
    const oldStock = Number(f.stock || 0);
    const newStock = Math.max(0, Number((oldStock + delta).toFixed(3)));
    const actualDelta = Number((newStock - oldStock).toFixed(3));
    if (actualDelta === 0) return;

    const batch = writeBatch(db);
    batch.update(storeDoc('fruits', fruitId), { stock: newStock });

    if (recordPurchase && actualDelta > 0) {
      const cost = actualDelta * Number(f.buyPrice);
      const tId = 't_' + Date.now();
      batch.set(storeDoc('transactions', tId), {
        id: tId,
        type: 'inventory_buy',
        paymentMethod: 'cash',
        date: getTodayDateStr(),
        desc: `Beli Stok ${f.name} (${actualDelta} ${f.unit})`,
        boughtItems: [{ fruitId: f.id, fruitName: f.name, qty: actualDelta, unit: f.unit, buyPrice: Number(f.buyPrice || 0) }],
        amount: cost,
        createdAt: Date.now()
      });
      await batch.commit();
      showToast(`Stok ${f.name} +${actualDelta} ${f.unit} (Persediaan +${formatRp(cost)})`);
    } else if (!recordPurchase && actualDelta < 0) {
      // Penyesuaian berkurang non-penjualan dicatat sebagai penyusutan agar Neraca tetap seimbang
      const lossVal = Math.abs(actualDelta) * Number(f.buyPrice);
      const tId = 'adj_' + Date.now();
      batch.set(storeDoc('transactions', tId), {
        id: tId,
        type: 'stock_out',
        fruitId: f.id,
        fruitName: f.name,
        unit: f.unit,
        qty: Math.abs(actualDelta),
        reason: 'Penyesuaian Stok Cepat',
        date: getTodayDateStr(),
        desc: `Kurangi Stok Cepat: ${f.name} (${Math.abs(actualDelta)} ${f.unit})`,
        amount: lossVal,
        createdAt: Date.now()
      });
      await batch.commit();
      showToast(`Stok ${f.name} sekarang ${newStock} ${f.unit}`);
    } else {
      await batch.commit();
      showToast(`Stok ${f.name} sekarang ${newStock} ${f.unit}`);
    }
  };

  const buyAllShoppingItems = async () => {
    if (!user || metrics.shoppingList.length === 0) return;
    const batch = writeBatch(db);
    let totalSpent = 0;

    const boughtItems = [];
    metrics.shoppingList.forEach((item) => {
      const fruit = fruits.find((f) => f.id === item.fruitId);
      if (fruit) {
        const qty = fruit.unit === 'kg' ? Number(item.deficit.toFixed(2)) : Math.ceil(item.deficit);
        batch.update(storeDoc('fruits', fruit.id), {
          stock: Number((Number(fruit.stock) + qty).toFixed(3))
        });
        totalSpent += qty * Number(fruit.buyPrice);
        boughtItems.push({ fruitId: fruit.id, fruitName: fruit.name, qty, unit: fruit.unit, buyPrice: Number(fruit.buyPrice || 0) });
      }
    });

    if (totalSpent > 0) {
      const tId = 't_' + Date.now();
      batch.set(storeDoc('transactions', tId), {
        id: tId,
        type: 'inventory_buy',
        paymentMethod: 'cash',
        date: getTodayDateStr(),
        desc: 'Belanja Stok Kekurangan Pesanan',
        boughtItems,
        amount: totalSpent,
        createdAt: Date.now()
      });
    }

    await batch.commit();
    showToast(`Semua belanja dibeli! Persediaan +${formatRp(totalSpent)}`);
  };

  const copyShoppingListWA = () => {
    if (metrics.shoppingList.length === 0) return showToast('Tidak ada daftar belanja yang kurang.');
    const itemsLines = metrics.shoppingList
      .map((it, i) => `${i + 1}. ${it.fruitName} — *${it.deficit} ${it.unit}*
    (Est. ${formatRp(it.estCost)})`)
      .join('\n\n');

    const msg = [
      '*DAFTAR BELANJA BUAH SUPPLIER — MFRUITS*',
      '',
      itemsLines,
      '',
      `*Total Estimasi Belanja:* ${formatRp(metrics.totalShoppingCost)}`
    ].join('\n');

    copyTextSafe(msg, 'Daftar belanja disalin untuk WhatsApp!');
  };

  const openFruitModal = (fruit) => {
    if (fruit) {
      setFruitForm({ ...fruit, stockSource: 'capital' });
    } else {
      setFruitForm({
        id: '',
        name: '',
        unit: 'kg',
        stock: 0,
        buyPrice: '',
        sellPrice: '',
        minStock: 1,
        stockSource: 'capital'
      });
    }
    setFruitModalOpen(true);
  };

  // Simpan Buah + Jurnal Penyeimbang Otomatis agar Neraca selalu Seimbang
  const saveFruitForm = async (e) => {
    e.preventDefault();
    if (!user) return;
    const batch = writeBatch(db);
    const id = fruitForm.id || 'f_' + Date.now();
    const newStock = Number(fruitForm.stock) || 0;
    const newBuyPrice = Number(fruitForm.buyPrice) || 0;
    const newSellPrice = Number(fruitForm.sellPrice) || 0;
    const cleanName = fruitForm.name.trim();
    const cleanUnit = (fruitForm.unit || 'kg').trim();

    if (fruitForm.id) {
      const oldFruit = fruits.find((f) => f.id === fruitForm.id);
      const oldVal = oldFruit ? Number(oldFruit.stock || 0) * Number(oldFruit.buyPrice || 0) : 0;
      const newVal = newStock * newBuyPrice;
      const diffVal = Number((newVal - oldVal).toFixed(2));

      if (Math.abs(diffVal) >= 1) {
        const tId = 'rev_' + Date.now();
        batch.set(storeDoc('transactions', tId), {
          id: tId,
          type: 'revaluation',
          date: getTodayDateStr(),
          desc: `Penyesuaian Nilai Stok: ${cleanName}`,
          amount: diffVal,
          createdAt: Date.now()
        });
      }
    } else if (newStock > 0 && newBuyPrice > 0) {
      const initVal = newStock * newBuyPrice;
      const tId = 'init_' + Date.now();
      if (fruitForm.stockSource === 'cash') {
        batch.set(storeDoc('transactions', tId), {
          id: tId,
          type: 'inventory_buy',
          paymentMethod: 'cash',
          date: getTodayDateStr(),
          desc: `Stok Awal (Kas Toko): ${cleanName} (${newStock} ${cleanUnit})`,
          amount: initVal,
          createdAt: Date.now()
        });
      } else {
        batch.set(storeDoc('transactions', tId), {
          id: tId,
          type: 'capital',
          paymentMethod: 'inventory',
          date: getTodayDateStr(),
          desc: `Modal Awal Persediaan: ${cleanName} (${newStock} ${cleanUnit})`,
          amount: initVal,
          createdAt: Date.now()
        });
      }
    }

    batch.set(storeDoc('fruits', id), {
      id,
      name: cleanName,
      unit: cleanUnit,
      stock: newStock,
      buyPrice: newBuyPrice,
      sellPrice: newSellPrice,
      minStock: Number(fruitForm.minStock) || 1
    });

    await batch.commit();
    setFruitModalOpen(false);
    showToast(fruitForm.id ? 'Data buah diperbarui!' : 'Buah baru ditambahkan & Neraca tercatat!');
  };

  const deleteFruit = async (fruitId) => {
    if (!user) return;
    const target = fruits.find((f) => f.id === fruitId);
    const batch = writeBatch(db);
    if (target) {
      const remVal = Number(target.stock || 0) * Number(target.buyPrice || 0);
      if (remVal > 0) {
        const tId = 'del_' + Date.now();
        batch.set(storeDoc('transactions', tId), {
          id: tId,
          type: 'stock_out',
          reason: 'Hapus Item Stok',
          date: getTodayDateStr(),
          desc: `Hapus Item Buah: ${target.name} (${target.stock} ${target.unit})`,
          amount: remVal,
          createdAt: Date.now()
        });
      }
    }
    batch.delete(storeDoc('fruits', fruitId));
    await batch.commit();
    showToast('Item buah dihapus.');
  };

  // Master Katalog Paket Bundling
  const openBundleCatalogModal = (bundle) => {
    if (bundle) {
      setBundleCatalogForm({
        id: bundle.id,
        name: bundle.name,
        sellPrice: bundle.sellPrice,
        desc: bundle.desc || '',
        items: bundle.items ? bundle.items.map((it) => ({ ...it })) : []
      });
    } else {
      const first = fruits[0];
      setBundleCatalogForm({
        id: '',
        name: '',
        sellPrice: '',
        desc: '',
        items: first
          ? [
              {
                fruitId: first.id,
                fruitName: first.name,
                qty: first.unit === 'kg' ? 0.5 : 1,
                unit: first.unit,
                buyPrice: first.buyPrice,
                sellPrice: first.sellPrice
              }
            ]
          : []
      });
    }
    setBundleCatalogModalOpen(true);
  };

  const bundleCatalogModalCost = useMemo(() => {
    return (bundleCatalogForm.items || []).reduce((s, it) => {
      const liveFruit = fruits.find((f) => f.id === it.fruitId);
      const buy = liveFruit ? Number(liveFruit.buyPrice) : Number(it.buyPrice || 0);
      return s + Number(it.qty || 0) * buy;
    }, 0);
  }, [bundleCatalogForm.items, fruits]);

  const saveBundleCatalogForm = async (e) => {
    e.preventDefault();
    if (!user || bundleCatalogForm.items.length === 0) return;
    const id = bundleCatalogForm.id || 'bnd_' + Date.now();
    const normalizedItems = bundleCatalogForm.items.map((it) => {
      const liveFruit = fruits.find((f) => f.id === it.fruitId);
      return {
        fruitId: it.fruitId,
        fruitName: liveFruit ? liveFruit.name : it.fruitName,
        qty: Number(it.qty) || 0,
        unit: liveFruit ? liveFruit.unit : it.unit,
        buyPrice: liveFruit ? Number(liveFruit.buyPrice) : Number(it.buyPrice || 0),
        sellPrice: liveFruit ? Number(liveFruit.sellPrice) : Number(it.sellPrice || 0)
      };
    });

    await setDoc(storeDoc('bundles', id), {
      id,
      name: bundleCatalogForm.name.trim(),
      sellPrice: Number(bundleCatalogForm.sellPrice) || 0,
      desc: bundleCatalogForm.desc.trim(),
      items: normalizedItems,
      createdAt: Date.now()
    });
    setBundleCatalogModalOpen(false);
    showToast(bundleCatalogForm.id ? 'Paket bundling diperbarui!' : 'Produk bundling baru disimpan!');
  };

  const deleteBundleCatalog = async (bundleId) => {
    if (!user) return;
    await deleteDoc(storeDoc('bundles', bundleId));
    showToast('Produk bundling dihapus.');
  };

  // Out Stock Non-Penjualan
  const openOutStockModal = () => {
    const available = fruits.filter((f) => Number(f.stock) > 0);
    const first = available[0] || fruits[0];
    setOutStockForm({
      fruitId: first ? first.id : '',
      qty: '',
      reason: 'Buah Busuk / Rusak',
      date: getTodayDateStr(),
      note: ''
    });
    setOutStockModalOpen(true);
  };

  const saveOutStockForm = async (e) => {
    e.preventDefault();
    if (!user || !outStockForm.fruitId) return;
    const fruit = fruits.find((f) => f.id === outStockForm.fruitId);
    if (!fruit) return;

    const qty = Number(outStockForm.qty) || 0;
    if (qty <= 0) return showToast('Jumlah pengeluaran stok harus lebih dari 0.');
    if (qty > Number(fruit.stock)) {
      return showToast(`Stok ${fruit.name} tidak cukup (tersisa ${fruit.stock} ${fruit.unit}).`);
    }

    const lossValue = qty * Number(fruit.buyPrice || 0);
    const batch = writeBatch(db);

    batch.update(storeDoc('fruits', fruit.id), {
      stock: Math.max(0, Number((Number(fruit.stock) - qty).toFixed(3)))
    });

    const tId = 'out_' + Date.now();
    batch.set(storeDoc('transactions', tId), {
      id: tId,
      type: 'stock_out',
      fruitId: fruit.id,
      fruitName: fruit.name,
      unit: fruit.unit,
      qty,
      reason: outStockForm.reason,
      date: outStockForm.date || getTodayDateStr(),
      desc: `Out Stok (${outStockForm.reason}): ${fruit.name} ${qty} ${fruit.unit}${outStockForm.note ? ' — ' + outStockForm.note.trim() : ''}`,
      amount: lossValue,
      createdAt: Date.now()
    });

    await batch.commit();
    setOutStockModalOpen(false);
    showToast(`Stok ${fruit.name} dikurangi ${qty} ${fruit.unit} (${outStockForm.reason})`);
  };

  const openBulkRestockModal = () => {
    const first = fruits[0];
    setBulkRows([
      {
        fruitId: first ? first.id : 'NEW',
        customName: '',
        unit: first ? first.unit : 'kg',
        qty: 1,
        buyPrice: first ? first.buyPrice : '',
        sellPrice: first ? first.sellPrice : ''
      }
    ]);
    setBulkDate(getTodayDateStr());
    setBulkNote('');
    setBulkPayMethod('cash');
    setBulkModalOpen(true);
  };

  const saveBulkRestockForm = async (e) => {
    e.preventDefault();
    if (!user || bulkRows.length === 0) return;
    const batch = writeBatch(db);
    let grandTotal = 0;
    let newFruitsCreated = 0;
    const summaryNames = [];
    const boughtItems = [];

    bulkRows.forEach((r, idx) => {
      const qty = Number(r.qty) || 0;
      const buyPrice = Number(r.buyPrice) || 0;
      if (qty <= 0) return;
      grandTotal += qty * buyPrice;

      if (r.fruitId === 'NEW') {
        const cleanName = (r.customName || '').trim();
        const cleanUnit = (r.unit || 'kg').trim();
        if (!cleanName) return;

        const existing = fruits.find(
          (f) =>
            f.name.trim().toLowerCase() === cleanName.toLowerCase() &&
            (f.unit || '').trim().toLowerCase() === cleanUnit.toLowerCase()
        );
        const sellPrice =
          r.sellPrice !== '' && Number(r.sellPrice) > 0 ? Number(r.sellPrice) : Math.round(buyPrice * 1.25);

        if (existing) {
          const oldVal = Number(existing.stock || 0) * Number(existing.buyPrice || 0);
          const effectiveBuy = buyPrice > 0 ? buyPrice : Number(existing.buyPrice || 0);
          const newTotalStock = Number((Number(existing.stock) + qty).toFixed(3));
          const expectedVal = oldVal + qty * buyPrice;
          const actualVal = newTotalStock * effectiveBuy;
          const revalDiff = Number((actualVal - expectedVal).toFixed(2));

          if (Math.abs(revalDiff) >= 1) {
            const revId = 'rev_' + Date.now() + '_' + idx;
            batch.set(storeDoc('transactions', revId), {
              id: revId,
              type: 'revaluation',
              date: bulkDate || getTodayDateStr(),
              desc: `Penyesuaian Harga Modal: ${existing.name}`,
              amount: revalDiff,
              createdAt: Date.now()
            });
          }

          batch.update(storeDoc('fruits', existing.id), {
            stock: newTotalStock,
            ...(buyPrice > 0 ? { buyPrice } : {}),
            ...(r.sellPrice !== '' && Number(r.sellPrice) > 0 ? { sellPrice: Number(r.sellPrice) } : {})
          });
          summaryNames.push(`${existing.name} (${qty} ${existing.unit})`);
          boughtItems.push({ fruitId: existing.id, fruitName: existing.name, qty, unit: existing.unit, buyPrice });
        } else {
          const newId = 'f_' + Date.now() + '_' + idx;
          batch.set(storeDoc('fruits', newId), {
            id: newId,
            name: cleanName,
            unit: cleanUnit,
            buyPrice,
            sellPrice,
            stock: qty,
            minStock: 1
          });
          newFruitsCreated++;
          summaryNames.push(`${cleanName} (${qty} ${cleanUnit})`);
          boughtItems.push({ fruitId: newId, fruitName: cleanName, qty, unit: cleanUnit, buyPrice });
        }
      } else {
        const found = fruits.find((f) => f.id === r.fruitId);
        if (found) {
          const oldVal = Number(found.stock || 0) * Number(found.buyPrice || 0);
          const effectiveBuy = buyPrice > 0 ? buyPrice : Number(found.buyPrice || 0);
          const newTotalStock = Number((Number(found.stock) + qty).toFixed(3));
          const expectedVal = oldVal + qty * buyPrice;
          const actualVal = newTotalStock * effectiveBuy;
          const revalDiff = Number((actualVal - expectedVal).toFixed(2));

          if (Math.abs(revalDiff) >= 1) {
            const revId = 'rev_' + Date.now() + '_' + idx;
            batch.set(storeDoc('transactions', revId), {
              id: revId,
              type: 'revaluation',
              date: bulkDate || getTodayDateStr(),
              desc: `Penyesuaian Harga Modal: ${found.name}`,
              amount: revalDiff,
              createdAt: Date.now()
            });
          }

          batch.update(storeDoc('fruits', found.id), {
            stock: newTotalStock,
            ...(buyPrice > 0 ? { buyPrice } : {}),
            ...(r.sellPrice !== '' && Number(r.sellPrice) > 0 ? { sellPrice: Number(r.sellPrice) } : {})
          });
          summaryNames.push(`${found.name} (${qty} ${found.unit})`);
          boughtItems.push({ fruitId: found.id, fruitName: found.name, qty, unit: found.unit, buyPrice });
        }
      }
    });

    if (grandTotal > 0) {
      const tId = 't_' + Date.now();
      batch.set(storeDoc('transactions', tId), {
        id: tId,
        type: 'inventory_buy',
        paymentMethod: bulkPayMethod,
        date: bulkDate || getTodayDateStr(),
        desc: `Belanja Stok${bulkNote ? ' (' + bulkNote + ')' : ''}: ${summaryNames.join(', ')}`,
        boughtItems,
        amount: grandTotal,
        createdAt: Date.now()
      });
    }

    await batch.commit();
    setBulkModalOpen(false);
    showToast(
      newFruitsCreated > 0
        ? `Belanja disimpan! ${newFruitsCreated} buah baru otomatis ditambahkan.`
        : `Stok berhasil diperbarui (${formatRp(grandTotal)})!`
    );
  };

  // ==========================================================================
  // 8. ORDER SATUAN (MULTI-BUAH) VS ORDER BUNDLING (DARI KATALOG)
  // ==========================================================================
  const openOrderSheet = (mode) => {
    const firstFruit = fruits[0];
    const firstBundle = bundles[0];
    setOrderMode(mode);
    setSingleOrderItems(
      firstFruit
        ? [
            {
              fruitId: firstFruit.id,
              fruitName: firstFruit.name,
              qty: 1,
              unit: firstFruit.unit,
              buyPrice: firstFruit.buyPrice,
              sellPrice: firstFruit.sellPrice
            }
          ]
        : []
    );
    setSelectedBundleId(firstBundle ? firstBundle.id : '');
    setBundleOrderQty(1);
    setOrderCustomer('');
    setOrderStatus('confirmed');
    setOrderCustomSell('');
    setOrderNotes('');
    setOrderSheetOpen(true);
  };

  const activeSelectedBundle = useMemo(
    () => bundles.find((b) => b.id === selectedBundleId) || null,
    [bundles, selectedBundleId]
  );

  const orderCalc = useMemo(() => {
    if (orderMode === 'single') {
      const totalCost = singleOrderItems.reduce(
        (s, it) => s + Number(it.qty || 0) * Number(it.buyPrice || 0),
        0
      );
      const baseSell = singleOrderItems.reduce(
        (s, it) => s + Number(it.qty || 0) * Number(it.sellPrice || 0),
        0
      );
      const finalSell = orderCustomSell !== '' ? Number(orderCustomSell) : baseSell;
      return { totalCost, finalSell, profit: finalSell - totalCost };
    } else {
      if (!activeSelectedBundle) return { totalCost: 0, finalSell: 0, profit: 0 };
      const mult = Number(bundleOrderQty) || 1;
      const unitCost = (activeSelectedBundle.items || []).reduce((s, it) => {
        const liveFruit = fruits.find((f) => f.id === it.fruitId);
        const buy = liveFruit ? Number(liveFruit.buyPrice) : Number(it.buyPrice || 0);
        return s + Number(it.qty || 0) * buy;
      }, 0);
      const totalCost = unitCost * mult;
      const baseSell = Number(activeSelectedBundle.sellPrice || 0) * mult;
      const finalSell = orderCustomSell !== '' ? Number(orderCustomSell) : baseSell;
      return { totalCost, finalSell, profit: finalSell - totalCost };
    }
  }, [orderMode, singleOrderItems, activeSelectedBundle, bundleOrderQty, orderCustomSell, fruits]);

  const saveOrderSheet = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (orderMode === 'single') {
      if (singleOrderItems.length === 0) return;
      const items = singleOrderItems.map((it) => ({
        ...it,
        qty: Number(Number(it.qty).toFixed(3))
      }));
      const id = 'o_' + Date.now();
      await setDoc(storeDoc('orders', id), {
        id,
        orderType: 'single',
        customer: orderCustomer.trim(),
        status: orderStatus,
        paymentStatus: 'unpaid',
        notes: orderNotes.trim() || items.map((i) => `${i.fruitName} ${i.qty} ${i.unit}`).join(', '),
        items,
        totalCost: orderCalc.totalCost,
        totalSell: orderCalc.finalSell,
        createdAt: Date.now()
      });
    } else {
      if (!activeSelectedBundle) return showToast('Pilih paket bundling terlebih dahulu.');
      const mult = Number(bundleOrderQty) || 1;
      const expandedItems = (activeSelectedBundle.items || []).map((it) => {
        const liveFruit = fruits.find((f) => f.id === it.fruitId);
        return {
          fruitId: it.fruitId,
          fruitName: liveFruit ? liveFruit.name : it.fruitName,
          qty: Number((Number(it.qty || 0) * mult).toFixed(3)),
          unit: liveFruit ? liveFruit.unit : it.unit,
          buyPrice: liveFruit ? Number(liveFruit.buyPrice) : Number(it.buyPrice || 0),
          sellPrice: liveFruit ? Number(liveFruit.sellPrice) : Number(it.sellPrice || 0)
        };
      });
      const bundleLabel = `${activeSelectedBundle.name} (${mult} paket)`;
      const id = 'o_' + Date.now();
      await setDoc(storeDoc('orders', id), {
        id,
        orderType: 'bundle',
        bundleName: activeSelectedBundle.name,
        bundleQty: mult,
        customer: orderCustomer.trim(),
        status: orderStatus,
        paymentStatus: 'unpaid',
        notes: orderNotes.trim() ? `${bundleLabel} • ${orderNotes.trim()}` : bundleLabel,
        items: expandedItems,
        totalCost: orderCalc.totalCost,
        totalSell: orderCalc.finalSell,
        createdAt: Date.now()
      });
    }

    setOrderSheetOpen(false);
    showToast('Order baru berhasil dicatat!');
  };

  const copyOrderPaymentWA = (o) => {
    const itemsText =
      o.items && o.items.length > 0
        ? o.items.map((it, idx) => `${idx + 1}. ${it.fruitName} — ${it.qty} ${it.unit}`).join('\n')
        : o.notes || '-';

    const banksText =
      bankAccounts.length > 0
        ? bankAccounts.map((b) => `• *${b.bank}*: ${b.number}
  a.n. ${b.holder}`).join('\n\n')
        : '• (Belum ada rekening tersimpan)';

    const sections = [
      `Halo Kak *${o.customer}*, berikut rincian pesanan buahnya di *MFruits* ya:`,
      o.orderType === 'bundle' && o.bundleName ? `*Paket:* ${o.bundleName} (${o.bundleQty || 1} paket)` : null,
      `*Daftar Buah:*
${itemsText}`,
      o.notes ? `_Catatan: ${o.notes}_` : null,
      `*Total Pembayaran:*
*${formatRp(o.totalSell)}*`,
      `Pembayaran bisa melalui Cash atau transfer ke rekening berikut:

${banksText}`,
      'Terima kasih sudah berbelanja di *MFruits*! 🍎🍊'
    ].filter(Boolean);

    copyTextSafe(sections.join('\n\n'), 'Rincian pesanan & info pembayaran disalin untuk WA!');
  };

  const confirmCompleteOrder = async (payStatus) => {
    if (!user || !completeOrderTarget) return;
    const o = completeOrderTarget;
    const batch = writeBatch(db);

    // Hitung HPP aktual berdasarkan harga modal buah terkini agar selisih stok & HPP selalu 100% klop
    let actualTotalCost = 0;
    (o.items || []).forEach((it) => {
      const f =
        fruits.find((item) => item.id === it.fruitId) ||
        fruits.find((item) => item.name.trim().toLowerCase() === it.fruitName.trim().toLowerCase());
      const unitBuy = f ? Number(f.buyPrice || 0) : Number(it.buyPrice || 0);
      actualTotalCost += Number(it.qty || 0) * unitBuy;
      if (f) {
        batch.update(storeDoc('fruits', f.id), {
          stock: Math.max(0, Number((Number(f.stock) - Number(it.qty)).toFixed(3)))
        });
      }
    });

    const methodObj = payStatus === 'paid' ? { paymentMethod: completePayMethod, paidDate: completeDate } : {};

    batch.update(storeDoc('orders', o.id), {
      status: 'completed',
      paymentStatus: payStatus,
      completedDate: completeDate,
      totalCost: actualTotalCost,
      ...methodObj
    });

    const saleId = 'sale_' + o.id;
    batch.set(storeDoc('transactions', saleId), {
      id: saleId,
      orderId: o.id,
      type: 'sale',
      paymentStatus: payStatus,
      date: completeDate,
      ...methodObj,
      customer: o.customer,
      notes: o.notes,
      items: o.items || [],
      desc: `Penjualan: ${o.customer} (${o.notes})`,
      amount: Number(o.totalSell),
      costAmount: actualTotalCost,
      createdAt: Date.now()
    });

    await batch.commit();
    setCompleteOrderTarget(null);
    showToast(
      payStatus === 'paid'
        ? `Order lunas (${completePayMethod === 'cash' ? 'Cash' : 'Transfer'}) & stok terpotong!`
        : 'Order selesai & masuk ke Tab Piutang!'
    );
  };

  const deleteOrder = async (orderId) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.delete(storeDoc('orders', orderId));
    const linked = transactions.filter((t) => t.orderId === orderId);
    linked.forEach((t) => batch.delete(storeDoc('transactions', t.id)));
    await batch.commit();
    showToast('Order & catatan terkait dihapus.');
  };

  // ==========================================================================
  // 9. PIUTANG (PELUNASAN TRANSFER / CASH), REKENING & KEUANGAN
  // ==========================================================================
  const markReceivablePaid = async (o, method) => {
    if (!user) return;
    const todayStr = getTodayDateStr();
    const batch = writeBatch(db);
    batch.update(storeDoc('orders', o.id), {
      paymentStatus: 'paid',
      paymentMethod: method,
      paidDate: todayStr
    });
    const trx = transactions.find((t) => t.orderId === o.id && t.type === 'sale');
    if (trx) {
      batch.update(storeDoc('transactions', trx.id), {
        paymentStatus: 'paid',
        paymentMethod: method,
        paidDate: todayStr
      });
    }
    await batch.commit();
    showToast(`Piutang ${o.customer} Lunas via ${method === 'cash' ? 'Cash' : 'Transfer'}!`);
  };

  const saveBankForm = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = 'b_' + Date.now();
    await setDoc(storeDoc('bankAccounts', id), {
      id,
      bank: bankForm.bank.trim(),
      number: bankForm.number.trim(),
      holder: bankForm.holder.trim()
    });
    setBankForm({ bank: '', number: '', holder: '' });
    setBankModalOpen(false);
    showToast('Rekening pembayaran ditambahkan!');
  };

  const openEditFinanceTrx = (t) => {
    setFinanceForm({
      id: t.id,
      type: t.type,
      date: t.date || getTodayDateStr(),
      desc: t.desc || '',
      amount: t.amount || '',
      payMethod: t.paymentMethod || 'cash'
    });
    setFinanceModalOpen(true);
  };

  const handleDeleteTransaction = async (t) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.delete(storeDoc('transactions', t.id));

    if (t.type === 'sale' && t.orderId) {
      batch.update(storeDoc('orders', t.orderId), { paymentStatus: 'unpaid' });
      await batch.commit();
      showToast('Penjualan dihapus & order dikembalikan ke Tab Piutang.');
      return;
    }

    if (t.type === 'inventory_buy') {
      if (t.boughtItems && t.boughtItems.length > 0) {
        t.boughtItems.forEach((it) => {
          const f =
            fruits.find((item) => item.id === it.fruitId) ||
            fruits.find((item) => item.name.trim().toLowerCase() === (it.fruitName || '').trim().toLowerCase());
          if (f) {
            batch.update(storeDoc('fruits', f.id), {
              stock: Math.max(0, Number((Number(f.stock || 0) - Number(it.qty || 0)).toFixed(3)))
            });
          }
        });
        await batch.commit();
        showToast('Belanja dihapus & stok buah otomatis dikurangi kembali!');
      } else {
        // Transaksi belanja lama tanpa rincian item: konversi nilai barangnya ke Modal Awal Barang agar Neraca tetap seimbang
        const syncId = 'conv_cap_' + Date.now();
        batch.set(storeDoc('transactions', syncId), {
          id: syncId,
          type: 'capital',
          paymentMethod: 'inventory',
          date: t.date || getTodayDateStr(),
          desc: `Konversi Stok Lama (${t.desc})`,
          amount: Number(t.amount || 0),
          createdAt: Date.now()
        });
        await batch.commit();
        showToast('Belanja lama dihapus & nilai stok dikonversi ke Modal Barang agar Neraca tetap seimbang.');
      }
      return;
    }

    if (t.type === 'stock_out' && t.fruitId && Number(t.qty || 0) > 0) {
      const f = fruits.find((item) => item.id === t.fruitId);
      if (f) {
        batch.update(storeDoc('fruits', f.id), {
          stock: Number((Number(f.stock || 0) + Number(t.qty || 0)).toFixed(3))
        });
      }
      await batch.commit();
      showToast('Riwayat Out Stok dihapus & stok buah dikembalikan!');
      return;
    }

    await batch.commit();
    showToast('Transaksi berhasil dihapus!');
  };

  const saveFinanceForm = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (financeForm.id) {
      await updateDoc(storeDoc('transactions', financeForm.id), {
        type: financeForm.type,
        paymentMethod: financeForm.payMethod || 'cash',
        date: financeForm.date || getTodayDateStr(),
        ...(financeForm.type === 'sale' ? { paidDate: financeForm.date || getTodayDateStr() } : {}),
        desc: financeForm.desc.trim(),
        amount: Number(financeForm.amount) || 0
      });
      setFinanceModalOpen(false);
      showToast('Transaksi berhasil diperbarui!');
    } else {
      const id = 't_' + Date.now();
      await setDoc(storeDoc('transactions', id), {
        id,
        type: financeForm.type,
        paymentMethod: financeForm.payMethod || 'cash',
        date: financeForm.date || getTodayDateStr(),
        desc: financeForm.desc.trim(),
        amount: Number(financeForm.amount) || 0,
        createdAt: Date.now()
      });
      setFinanceModalOpen(false);
      showToast('Transaksi keuangan dicatat!');
    }
  };

  // Sinkronisasi Penyeimbang Neraca untuk data lama sebelum pembaruan ini
  const syncLegacyBalanceDiff = async (diffAmount) => {
    if (!user || Math.abs(diffAmount) < 1) return;
    const id = 'sync_cap_' + Date.now();
    await setDoc(storeDoc('transactions', id), {
      id,
      type: 'capital',
      paymentMethod: 'inventory',
      date: getTodayDateStr(),
      desc: 'Penyesuaian Modal Awal Stok Lama',
      amount: diffAmount,
      createdAt: Date.now()
    });
    showToast(`Selisih ${formatRp(diffAmount)} berhasil dicatat sebagai Modal Awal Stok!`);
  };

  // ==========================================================================
  // 10. DATA KEUANGAN PER PERIODE & AUDIT NERACA DINAMIS
  // ==========================================================================
  const salesList = useMemo(
    () => transactions.filter((t) => t.type === 'sale' && isDateInPeriod(t.date, financePeriods.sales)),
    [transactions, financePeriods.sales]
  );

  const topFruits = useMemo(() => {
    const map = {};
    salesList.forEach((t) => {
      const linkedOrder = orders.find((o) => o.id === t.orderId);
      const itemList = t.items && t.items.length > 0 ? t.items : linkedOrder?.items || [];
      itemList.forEach((it) => {
        const key = `${it.fruitName.trim().toLowerCase()}|${(it.unit || '').trim().toLowerCase()}`;
        if (!map[key]) {
          map[key] = { fruitName: it.fruitName, unit: it.unit || '', totalQty: 0, totalModal: 0, trxCount: 0 };
        }
        map[key].totalQty = Number((map[key].totalQty + Number(it.qty || 0)).toFixed(3));
        map[key].totalModal += Number(it.qty || 0) * Number(it.buyPrice || 0);
        map[key].trxCount += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  }, [salesList, orders]);

  const pnlData = useMemo(() => {
    const list = transactions.filter((t) => isDateInPeriod(t.date, financePeriods.pnl));
    const rev = list.filter((t) => t.type === 'sale').reduce((s, t) => s + Number(t.amount || 0), 0);
    const hpp = list.filter((t) => t.type === 'sale').reduce((s, t) => s + Number(t.costAmount || 0), 0);
    const gross = rev - hpp;
    const opex = list.filter((t) => t.type === 'opex').reduce((s, t) => s + Number(t.amount || 0), 0);
    const stockLoss = list.filter((t) => t.type === 'stock_out').reduce((s, t) => s + Number(t.amount || 0), 0);
    const reval = list.filter((t) => t.type === 'revaluation').reduce((s, t) => s + Number(t.amount || 0), 0);
    const net = gross - opex - stockLoss + reval;
    const margin = rev > 0 ? Math.round((net / rev) * 100) : 0;
    return { rev, hpp, gross, opex, stockLoss, reval, net, margin };
  }, [transactions, financePeriods.pnl]);

  const balanceData = useMemo(() => {
    const list = transactions.filter((t) => isDateInPeriod(t.date, financePeriods.balance));
    const capIn = list.filter((t) => t.type === 'capital').reduce((s, t) => s + Number(t.amount || 0), 0);
    const capCashIn = list
      .filter((t) => t.type === 'capital' && t.paymentMethod !== 'inventory')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const paidSales = list.filter((t) => t.type === 'sale' && t.paymentStatus === 'paid');
    const paidTotal = paidSales.reduce((s, t) => s + Number(t.amount || 0), 0);
    const paidCashOnly = paidSales
      .filter((t) => t.paymentMethod === 'cash')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const paidTransferOnly = paidSales
      .filter((t) => t.paymentMethod !== 'cash')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const unpaidAr = list.filter((t) => t.type === 'sale' && t.paymentStatus === 'unpaid').reduce((s, t) => s + Number(t.amount || 0), 0);
    const invBought = list.filter((t) => t.type === 'inventory_buy').reduce((s, t) => s + Number(t.amount || 0), 0);
    const opexPaid = list.filter((t) => t.type === 'opex').reduce((s, t) => s + Number(t.amount || 0), 0);
    const stockLoss = list.filter((t) => t.type === 'stock_out').reduce((s, t) => s + Number(t.amount || 0), 0);
    const reval = list.filter((t) => t.type === 'revaluation').reduce((s, t) => s + Number(t.amount || 0), 0);

    const rev = list.filter((t) => t.type === 'sale').reduce((s, t) => s + Number(t.amount || 0), 0);
    const hpp = list.filter((t) => t.type === 'sale').reduce((s, t) => s + Number(t.costAmount || 0), 0);
    const net = rev - hpp - opexPaid - stockLoss + reval;
    const cash = capCashIn + paidTotal - invBought - opexPaid;

    const totalAssets = cash + unpaidAr + metrics.inventoryValue;
    const totalEquity = capIn + net;
    const diff = Math.round(totalAssets - totalEquity);
    const isBalanced = Math.abs(diff) < 1;

    return {
      cash,
      paidCashOnly,
      paidTransferOnly,
      unpaidAr,
      inv: metrics.inventoryValue,
      totalAssets,
      capIn,
      net,
      totalEquity,
      diff,
      isBalanced
    };
  }, [transactions, financePeriods.balance, metrics.inventoryValue]);

  const cashflowData = useMemo(() => {
    let cfIn = 0;
    let cfInCash = 0;
    let cfInTransfer = 0;
    let cfOut = 0;
    const items = [];
    transactions.forEach((t) => {
      if (t.type === 'capital' && t.paymentMethod !== 'inventory' && isDateInPeriod(t.date, financePeriods.cashflow)) {
        const amt = Number(t.amount || 0);
        cfIn += amt;
        if (t.paymentMethod === 'cash') cfInCash += amt;
        else cfInTransfer += amt;
        items.push({ ...t, effectiveDate: t.date, dir: 'in' });
      } else if (t.type === 'sale' && t.paymentStatus === 'paid') {
        const cashDate = t.paidDate || t.date;
        if (isDateInPeriod(cashDate, financePeriods.cashflow)) {
          const amt = Number(t.amount || 0);
          cfIn += amt;
          if (t.paymentMethod === 'cash') cfInCash += amt;
          else cfInTransfer += amt;
          items.push({ ...t, effectiveDate: cashDate, dir: 'in' });
        }
      } else if ((t.type === 'inventory_buy' || t.type === 'opex') && isDateInPeriod(t.date, financePeriods.cashflow)) {
        cfOut += Number(t.amount || 0);
        items.push({ ...t, effectiveDate: t.date, dir: 'out' });
      }
    });
    const nonCashCapItems = transactions.filter(
      (t) => t.type === 'capital' && t.paymentMethod === 'inventory' && isDateInPeriod(t.date, financePeriods.cashflow)
    );
    return { cfIn, cfInCash, cfInTransfer, cfOut, items, nonCashCapItems };
  }, [transactions, financePeriods.cashflow]);

  const stockOutHistory = useMemo(
    () => transactions.filter((t) => t.type === 'stock_out'),
    [transactions]
  );

  const activeThemeVars = FRESH_MODES[colorMode] || FRESH_MODES.light;

  // ==========================================================================
  // 11. HALAMAN GERBANG LOGIN (JIKA BELUM LOGIN DENGAN EMAIL TERDAFTAR)
  // ==========================================================================
  if (authChecking) {
    return (
      <div style={{ backgroundColor: activeThemeVars['--bg-outer'], minHeight: '100vh' }} className="flex justify-center font-sans">
        <div style={{ ...activeThemeVars, backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} className="w-full max-w-[440px] min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-3">
          <MFruitsLogo sizeClass="w-16 h-16 rounded-3xl p-2" />
          <p className="text-xs font-bold opacity-75">Memeriksa akses MFruits...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ backgroundColor: activeThemeVars['--bg-outer'], minHeight: '100vh' }} className="flex justify-center font-sans">
        <div
          style={{ ...activeThemeVars, backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          className="w-full max-w-[440px] min-h-screen flex flex-col justify-between p-6 shadow-2xl"
        >
          <div className="flex justify-end">
            <button
              onClick={handleToggleColorMode}
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              className="w-10 h-10 rounded-xl border flex items-center justify-center"
              title="Ganti Mode Terang/Gelap"
            >
              {colorMode === 'light' ? '🌙' : '☀️'}
            </button>
          </div>

          <div className="space-y-6 text-center my-auto">
            <div className="flex flex-col items-center space-y-3">
              <MFruitsLogo sizeClass="w-20 h-20 rounded-3xl p-2.5" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">MFruits</h1>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs font-semibold">
                  Manis Segar Menyehatkan
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-3xl p-5 space-y-4 text-left shadow-sm">
              <div className="space-y-1">
                <h2 className="text-sm font-extrabold">Akses Terbatas (Privat)</h2>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs leading-relaxed">
                  Sistem pengelolaan stok, order, piutang, dan pembukuan <b>MFruits</b> hanya dapat dibuka oleh akun Google yang terdaftar.
                </p>
              </div>

              {authError && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-500 text-xs font-semibold">
                  {authError}
                </div>
              )}

              <button
                onClick={handleGoogleLogin}
                style={{ backgroundColor: 'var(--accent)' }}
                className="w-full py-3.5 rounded-2xl text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2.5 active:scale-[0.99] transition-transform"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 bg-white rounded-full p-0.5">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
                </svg>
                <span>Masuk dengan Akun Google</span>
              </button>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)' }} className="text-[11px] text-center">
            MFruits Cloud System • Terlindungi Firebase Auth
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 12. DASHBOARD UTAMA (JIKA EMAIL TERDAFTAR)
  // ==========================================================================
  return (
    <div style={{ backgroundColor: activeThemeVars['--bg-outer'], minHeight: '100vh' }} className="flex justify-center font-sans transition-colors duration-200">
      <div
        style={{
          ...activeThemeVars,
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-main)'
        }}
        className="w-full max-w-[440px] min-h-screen relative flex flex-col shadow-2xl overflow-x-hidden transition-colors duration-200"
      >
        {/* TOAST */}
        {toastMsg && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[390px]">
            <div className="px-4 py-3 rounded-2xl shadow-xl text-white text-xs font-semibold bg-emerald-600">
              {toastMsg}
            </div>
          </div>
        )}

        {/* HEADER MFRUITS + OPSI 1B LOGO + PROFIL AKUN + TOGGLE TEMA */}
        <header style={{ background: 'var(--header-grad)' }} className="px-4 py-4 text-white rounded-b-[1.75rem] shadow-md sticky top-0 z-30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <MFruitsLogo />
              <div>
                <h1 className="font-extrabold text-base leading-tight tracking-tight">MFruits</h1>
                <p className="text-[11px] text-white/85 font-medium">
                  Manis Segar Menyehatkan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAccountModalOpen(true)}
                title={`Login sebagai ${user.email}`}
                aria-label="Info Akun Terdaftar"
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center shadow-inner relative"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-300" />
              </button>

              <button
                onClick={handleToggleColorMode}
                title={colorMode === 'light' ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang'}
                aria-label="Ganti Tema Terang/Gelap"
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center shadow-inner"
              >
                {colorMode === 'light' ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 px-4 pt-4 pb-28 space-y-4">
          {dbError && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500 text-rose-500 text-xs font-semibold">
              {dbError}
            </div>
          )}

          {/* ================= VIEW 1: BERANDA ================= */}
          {currentView === 'home' && (
            <section className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3">
                  <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Persediaan</span>
                  <strong className="text-xs font-extrabold mt-0.5 block">{formatRp(metrics.inventoryValue)}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3">
                  <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Kurang Belanja</span>
                  <strong className="text-xs font-extrabold text-amber-500 mt-0.5 block">{formatRp(metrics.totalShoppingCost)}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3">
                  <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Laba Bersih</span>
                  <strong className="text-xs font-extrabold text-emerald-500 mt-0.5 block">{formatRp(metrics.netProfitAll)}</strong>
                </div>
              </div>

              {/* Shopping List */}
              <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold">Daftar Belanja Supplier</h2>
                    <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Otomatis dari selisih Order vs Stok Rumah</p>
                  </div>
                  <button
                    onClick={copyShoppingListWA}
                    style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                  >
                    Salin WA
                  </button>
                </div>

                {metrics.shoppingList.length === 0 ? (
                  <div style={{ backgroundColor: 'var(--bg-card-sub)', color: 'var(--text-muted)' }} className="p-3 rounded-xl text-center text-xs font-semibold">
                    Semua kebutuhan pesanan tercukupi oleh stok di rumah!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {metrics.shoppingList.map((item, idx) => (
                      <div key={idx} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-xs font-extrabold block">{item.fruitName}</strong>
                          <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                            Kurang: <b className="text-amber-500">{item.deficit} {item.unit}</b> • Est. {formatRp(item.estCost)}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            item.fruitId &&
                            adjustStock(item.fruitId, item.unit === 'kg' ? Number(item.deficit.toFixed(2)) : Math.ceil(item.deficit), true)
                          }
                          style={{ backgroundColor: 'var(--accent)' }}
                          className="px-2.5 py-1.5 rounded-xl text-white text-[11px] font-bold shrink-0"
                        >
                          + Beli
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={buyAllShoppingItems}
                      style={{ backgroundColor: 'var(--accent)' }}
                      className="w-full py-2.5 rounded-xl text-white text-xs font-bold shadow-sm"
                    >
                      Beli Semua Sekarang (+Persediaan)
                    </button>
                  </div>
                )}
              </div>

              {/* Reminder Stok */}
              <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold">Reminder Stok Habis & Menipis</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500">
                    {metrics.lowStockItems.length} Alert
                  </span>
                </div>
                {metrics.lowStockItems.length === 0 ? (
                  <div style={{ backgroundColor: 'var(--bg-card-sub)', color: 'var(--text-muted)' }} className="p-3 rounded-xl text-center text-xs font-semibold">
                    Stok buah aman terkendali.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {metrics.lowStockItems.map((f) => {
                      const empty = Number(f.stock) <= 0;
                      return (
                        <div key={f.id} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <strong className="text-xs font-extrabold">{f.name}</strong>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold text-white ${empty ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                {empty ? 'HABIS' : 'MENIPIS'}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                              Sisa: {f.stock} {f.unit} • Modal {formatRp(f.buyPrice)}
                            </span>
                          </div>
                          <button
                            onClick={() => adjustStock(f.id, 1, true)}
                            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                            className="border px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold"
                          >
                            +1 Beli
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================= VIEW 2: STOK BUAH & KATALOG PAKET BUNDLING ================= */}
          {currentView === 'stock' && (
            <section className="space-y-3">
              {/* Header Ringkas + 2 Tombol Utama */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Stok MFruits</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                    {fruits.length} item • Nilai {formatRp(metrics.inventoryValue)}
                  </p>
                </div>
                {stockFilter === 'bundles' ? (
                  <button
                    onClick={() => openBundleCatalogModal(null)}
                    style={{ backgroundColor: 'var(--accent)' }}
                    className="px-3.5 py-2 rounded-xl text-white text-xs font-extrabold shadow-xs"
                  >
                    + Paket Bundling
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={openBulkRestockModal}
                      style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                      className="px-3 py-2 rounded-xl text-xs font-extrabold"
                    >
                      + Belanja
                    </button>
                    <button
                      onClick={() => openFruitModal(null)}
                      style={{ backgroundColor: 'var(--accent)' }}
                      className="px-3 py-2 rounded-xl text-white text-xs font-extrabold"
                    >
                      + Buah
                    </button>
                  </div>
                )}
              </div>

              {/* Tab Utama Segmented: Daftar Buah vs Paket Bundling */}
              <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl grid grid-cols-2 gap-1 p-1">
                <button
                  onClick={() => setStockFilter('all')}
                  style={
                    stockFilter !== 'bundles'
                      ? { backgroundColor: 'var(--accent)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                  className="py-2 rounded-xl text-xs font-extrabold transition-colors"
                >
                  Stok Buah ({fruits.length})
                </button>
                <button
                  onClick={() => setStockFilter('bundles')}
                  style={
                    stockFilter === 'bundles'
                      ? { backgroundColor: 'var(--accent)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                  className="py-2 rounded-xl text-xs font-extrabold transition-colors"
                >
                  Paket Bundling ({bundles.length})
                </button>
              </div>

              {stockFilter === 'bundles' ? (
                /* SUB-VIEW: KATALOG PAKET BUNDLING */
                <div className="space-y-2.5">
                  {bundles.length === 0 ? (
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }} className="border rounded-2xl p-6 text-center text-xs space-y-1.5">
                      <p className="font-bold">Belum ada Paket Bundling</p>
                      <p className="text-[11px]">Ketuk <b>+ Paket Bundling</b> di kanan atas untuk membuat paket siap jual.</p>
                    </div>
                  ) : (
                    bundles.map((b) => {
                      const unitCost = (b.items || []).reduce((s, it) => {
                        const liveF = fruits.find((f) => f.id === it.fruitId);
                        const buy = liveF ? Number(liveF.buyPrice) : Number(it.buyPrice || 0);
                        return s + Number(it.qty || 0) * buy;
                      }, 0);
                      const estProfit = Number(b.sellPrice || 0) - unitCost;

                      return (
                        <div key={b.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <strong className="text-sm font-extrabold block">{b.name}</strong>
                              <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                                Modal {formatRp(unitCost)} • Jual <b className="text-emerald-500">{formatRp(b.sellPrice)}</b> (+{formatRp(estProfit)})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => openBundleCatalogModal(b)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                Edit
                              </button>
                              <button onClick={() => deleteBundleCatalog(b.id)} className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold">
                                ×
                              </button>
                            </div>
                          </div>
                          <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="px-3 py-2 rounded-xl text-[11px] flex flex-wrap gap-x-3 gap-y-1">
                            {(b.items || []).map((it, idx) => (
                              <span key={idx}>• {it.fruitName} <b>({it.qty} {it.unit})</b></span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* SUB-VIEW: DAFTAR STOK BUAH SIMPLE & RINGKAS */
                <>
                  {/* Pencarian Cepat + Tombol Out Stok */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cari nama buah..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                      className="flex-1 border px-3 py-2 rounded-xl text-xs outline-none font-medium"
                    />
                    <button
                      onClick={openOutStockModal}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-extrabold shrink-0"
                    >
                      - Out Stok
                    </button>
                  </div>

                  {/* Pill Filter Status Ringkas */}
                  <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold pb-0.5">
                    {[
                      { id: 'all', label: 'Semua' },
                      { id: 'low', label: `Menipis / Habis (${metrics.lowStockItems.length})` },
                      { id: 'out_history', label: `Riwayat Out (${stockOutHistory.length})` }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setStockFilter(f.id)}
                        style={
                          stockFilter === f.id
                            ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent)' }
                            : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                        }
                        className="px-2.5 py-1 rounded-lg border shrink-0"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {stockFilter === 'out_history' ? (
                    <div className="space-y-2">
                      {stockOutHistory.length === 0 ? (
                        <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }} className="border rounded-2xl p-6 text-center text-xs">
                          Belum ada riwayat pengeluaran stok non-penjualan.
                        </div>
                      ) : (
                        stockOutHistory.map((t) => (
                          <div key={t.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <span className="text-[10px] font-extrabold text-rose-500 block">{t.reason} • {t.date}</span>
                              <strong className="block truncate mt-0.5">{t.desc}</strong>
                            </div>
                            <div className="text-right shrink-0">
                              <strong className="text-rose-500 block">-{formatRp(t.amount)}</strong>
                              <button onClick={() => handleDeleteTransaction(t)} className="text-[10px] text-rose-500 font-bold">
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : fruits.length === 0 ? (
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }} className="border rounded-2xl p-6 text-center text-xs">
                      Belum ada data buah. Ketuk <b>+ Belanja</b> atau <b>+ Buah</b> untuk mulai.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fruits
                        .filter((f) => {
                          const matchQuery = f.name.toLowerCase().includes(stockSearch.trim().toLowerCase());
                          if (!matchQuery) return false;
                          if (stockFilter === 'low') return Number(f.stock) <= Number(f.minStock);
                          return true;
                        })
                        .map((f) => {
                          const empty = Number(f.stock) <= 0;
                          const low = Number(f.stock) <= Number(f.minStock);
                          return (
                            <div
                              key={f.id}
                              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                              className="border rounded-2xl p-3 flex items-center justify-between gap-2.5"
                            >
                              {/* Kiri: Nama, Status & Harga Ringkas (Ketuk untuk Edit) */}
                              <div onClick={() => openFruitModal(f)} className="min-w-0 flex-1 cursor-pointer">
                                <div className="flex items-center gap-1.5">
                                  <strong className="text-sm font-extrabold truncate">{f.name}</strong>
                                  {empty ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-extrabold shrink-0">HABIS</span>
                                  ) : low ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-extrabold shrink-0">MENIPIS</span>
                                  ) : null}
                                </div>
                                <div style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span>Modal {formatRp(f.buyPrice)}</span>
                                  <span>•</span>
                                  <span className="text-emerald-500 font-bold">Jual {formatRp(f.sellPrice)}/{f.unit}</span>
                                </div>
                              </div>

                              {/* Kanan: Angka Sisa Stok Besar & Kontrol Cepat */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <span className={`text-sm font-extrabold block leading-tight ${empty ? 'text-rose-500' : low ? 'text-amber-500' : ''}`}>
                                    {f.stock} <span className="text-[11px] font-bold opacity-80">{f.unit}</span>
                                  </span>
                                  {f.unit === 'kg' && Number(f.stock) > 0 && (
                                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">
                                      {Math.round(Number(f.stock) * 1000).toLocaleString('id-ID')} gr
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => adjustStock(f.id, f.unit === 'kg' ? -0.25 : -1, false)}
                                    title={f.unit === 'kg' ? 'Kurangi 0.25 kg' : 'Kurangi 1'}
                                    style={{ backgroundColor: 'var(--bg-card-sub)' }}
                                    className="w-7 h-7 rounded-lg font-extrabold text-xs flex items-center justify-center"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={() => adjustStock(f.id, 1, true)}
                                    title="Tambah Beli +1"
                                    style={{ backgroundColor: 'var(--accent)' }}
                                    className="w-7 h-7 rounded-lg text-white font-extrabold text-xs flex items-center justify-center"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={() => openFruitModal(f)}
                                    title="Edit / Hapus Buah"
                                    style={{ backgroundColor: 'var(--bg-card-sub)', color: 'var(--text-muted)' }}
                                    className="w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center"
                                  >
                                    ✎
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ================= VIEW 3: ORDER & BUNDLING ================= */}
          {currentView === 'orders' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Order & Request Pelanggan</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Order satuan multi-buah & paket bundling</p>
                </div>
                <button
                  onClick={() => openOrderSheet('bundle')}
                  style={{ backgroundColor: 'var(--accent)' }}
                  className="px-3 py-2 rounded-xl text-white text-xs font-bold"
                >
                  + Order Bundling
                </button>
              </div>

              {orders.length === 0 ? (
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }} className="border rounded-2xl p-6 text-center text-xs">
                  Belum ada daftar pesanan. Tekan <b>+ Order Baru</b> di kanan bawah untuk mencatat order.
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => {
                    const isDone = o.status === 'completed';
                    const isReq = o.status === 'request';
                    const profit = Number(o.totalSell) - Number(o.totalCost);

                    return (
                      <div
                        key={o.id}
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                        className={`border rounded-2xl p-4 space-y-3 ${isDone ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isDone
                                    ? 'bg-slate-500/15 text-slate-400'
                                    : isReq
                                    ? 'bg-amber-500/15 text-amber-500'
                                    : 'bg-emerald-500/15 text-emerald-500'
                                }`}
                              >
                                {isDone ? 'Selesai' : isReq ? 'Request' : 'Pesanan Pasti'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/15 text-indigo-400">
                                {o.orderType === 'bundle' ? 'BUNDLING' : 'SATUAN'}
                              </span>
                              {isDone && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white ${o.paymentStatus === 'paid' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                                  {o.paymentStatus === 'paid'
                                    ? `LUNAS (${o.paymentMethod === 'cash' ? 'CASH' : 'TRANSFER'})`
                                    : 'PIUTANG'}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-extrabold mt-1">{o.customer}</h3>
                            <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">{o.notes}</p>
                          </div>
                          <button onClick={() => deleteOrder(o.id)} className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold">
                            Hapus
                          </button>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1 text-xs">
                          {(o.items || []).map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{it.fruitName} ({it.qty} {it.unit})</span>
                              <span style={{ color: 'var(--text-muted)' }}>Modal {formatRp(it.qty * it.buyPrice)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <div>
                            <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Modal / Jual</span>
                            <strong>{formatRp(o.totalCost)} / <span className="text-emerald-500">{formatRp(o.totalSell)}</span></strong>
                          </div>
                          <div className="text-right">
                            <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Est. Laba</span>
                            <strong className="text-teal-500">+{formatRp(profit)}</strong>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <button
                            onClick={() => copyOrderPaymentWA(o)}
                            style={{ backgroundColor: 'var(--bg-card-sub)', borderColor: 'var(--border-color)' }}
                            className="w-full py-2 rounded-xl border text-xs font-bold"
                          >
                            Salin Rincian Pembayaran WA
                          </button>
                          {!isDone && (
                            <div className="flex items-center gap-2">
                              {isReq && (
                                <button
                                  onClick={() => updateDoc(storeDoc('orders', o.id), { status: 'confirmed' })}
                                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-extrabold"
                                >
                                  Deal Request
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setCompleteOrderTarget(o);
                                  setCompleteDate(getTodayDateStr());
                                  setCompletePayMethod('transfer');
                                }}
                                style={{ backgroundColor: 'var(--accent)' }}
                                className="flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold"
                              >
                                Selesai & Potong Stok
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================= VIEW 4: PIUTANG & REKENING ================= */}
          {currentView === 'receivables' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Piutang & Rekening</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Tagihan belum lunas & info transfer</p>
                </div>
                <button
                  onClick={() => setBankModalOpen(true)}
                  style={{ backgroundColor: 'var(--accent)' }}
                  className="px-3 py-2 rounded-xl text-white text-xs font-bold"
                >
                  + Rekening
                </button>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold">Informasi Rekening Pembayaran</span>
                  <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">Tap salin untuk WA</span>
                </div>
                {bankAccounts.length === 0 ? (
                  <div style={{ backgroundColor: 'var(--bg-card-sub)', color: 'var(--text-muted)' }} className="p-3 rounded-xl text-center text-xs">
                    Belum ada rekening. Tekan <b>+ Rekening</b> di atas untuk menambahkan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bankAccounts.map((b) => (
                      <div key={b.id} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div>
                          <strong className="block">{b.bank} — {b.number}</strong>
                          <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">a.n. {b.holder}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyTextSafe(`${b.bank} ${b.number} a.n. ${b.holder}`, 'No. Rekening disalin!')}
                            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                          >
                            Salin
                          </button>
                          <button onClick={() => deleteDoc(storeDoc('bankAccounts', b.id))} className="px-2 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold">
                            x
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(() => {
                const unpaidList = orders.filter((o) => o.status === 'completed' && o.paymentStatus === 'unpaid');
                const totalAr = unpaidList.reduce((s, o) => s + Number(o.totalSell || 0), 0);
                return (
                  <>
                    <div className="rounded-2xl p-3.5 flex items-center justify-between bg-amber-500/15 border border-amber-500/30">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-500 block">Total Piutang Belum Lunas</span>
                        <strong className="text-base font-extrabold text-amber-500">{formatRp(totalAr)}</strong>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-white text-xs font-bold">{unpaidList.length} Tagihan</span>
                    </div>

                    <div className="space-y-2.5">
                      {unpaidList.length === 0 ? (
                        <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }} className="border rounded-2xl p-6 text-center text-xs">
                          Tidak ada piutang pelanggan yang belum dibayar.
                        </div>
                      ) : (
                        unpaidList.map((o) => (
                          <div key={o.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 space-y-2.5 text-xs">
                            <div className="flex items-start justify-between">
                              <div>
                                <strong className="text-sm font-extrabold block">{o.customer}</strong>
                                <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">Tgl Order: {o.completedDate || '-'} • {o.notes}</span>
                              </div>
                              <strong className="text-sm font-extrabold text-amber-500">{formatRp(o.totalSell)}</strong>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => copyOrderPaymentWA(o)}
                                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                                className="py-2 rounded-xl font-bold"
                              >
                                Tagih WA
                              </button>
                              <button
                                onClick={() => markReceivablePaid(o, 'transfer')}
                                className="py-2 rounded-xl bg-sky-600 text-white font-bold"
                              >
                                Lunas Transfer
                              </button>
                              <button
                                onClick={() => markReceivablePaid(o, 'cash')}
                                className="py-2 rounded-xl bg-emerald-600 text-white font-bold"
                              >
                                Lunas Cash
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {/* ================= VIEW 5: KEUANGAN ================= */}
          {currentView === 'finance' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Laporan Keuangan MFruits</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Penjualan, Laba Rugi, Neraca & Kas</p>
                </div>
                <button
                  onClick={() => {
                    setFinanceForm({ id: '', type: 'opex', date: getTodayDateStr(), desc: '', amount: '', payMethod: 'cash' });
                    setFinanceModalOpen(true);
                  }}
                  style={{ backgroundColor: 'var(--accent)' }}
                  className="px-3 py-2 rounded-xl text-white text-xs font-bold"
                >
                  + Catat Kas
                </button>
              </div>

              {/* 4 Sub-Tab Utama */}
              <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl grid grid-cols-4 gap-1 p-1">
                {[
                  { id: 'sales', label: 'Penjualan' },
                  { id: 'pnl', label: 'Laba Rugi' },
                  { id: 'balance', label: 'Neraca' },
                  { id: 'cashflow', label: 'Arus Kas' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFinanceSubTab(tab.id)}
                    style={
                      financeSubTab === tab.id
                        ? { backgroundColor: 'var(--accent)', color: '#fff' }
                        : { color: 'var(--text-muted)' }
                    }
                    className="py-2 rounded-xl text-[11px] font-extrabold"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filter Periode */}
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {[
                  { id: 'today', label: 'Hari Ini' },
                  { id: '7d', label: '7 Hari' },
                  { id: 'month', label: 'Bulan Ini' },
                  { id: 'all', label: 'Semua' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setFinancePeriods({ ...financePeriods, [financeSubTab]: p.id })}
                    style={
                      financePeriods[financeSubTab] === p.id
                        ? { backgroundColor: 'var(--accent)', color: '#fff' }
                        : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                    }
                    className="px-2.5 py-1.5 rounded-lg border"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* SUB-TAB 1: PENJUALAN & REKAPAN TERLARIS */}
              {financeSubTab === 'sales' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-2.5">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Omzet</span>
                      <strong className="text-xs font-extrabold">{formatRp(salesList.reduce((s, t) => s + Number(t.amount || 0), 0))}</strong>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-2.5">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Modal/HPP</span>
                      <strong className="text-xs font-extrabold text-rose-500">{formatRp(salesList.reduce((s, t) => s + Number(t.costAmount || 0), 0))}</strong>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-2.5">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Laba Kotor</span>
                      <strong className="text-xs font-extrabold text-emerald-500">
                        {formatRp(salesList.reduce((s, t) => s + (Number(t.amount || 0) - Number(t.costAmount || 0)), 0))}
                      </strong>
                    </div>
                  </div>

                  {/* Rekapan Buah Terlaris */}
                  <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-extrabold">Rekapan Buah Paling Laku</h3>
                        <p style={{ color: 'var(--text-muted)' }} className="text-[10px]">Peringkat volume terjual sesuai periode aktif</p>
                      </div>
                      <span style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }} className="px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {topFruits.length} Jenis
                      </span>
                    </div>

                    {topFruits.length === 0 ? (
                      <div style={{ backgroundColor: 'var(--bg-card-sub)', color: 'var(--text-muted)' }} className="p-3 rounded-xl text-center text-[11px]">
                        Belum ada data buah terjual pada periode ini.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {topFruits.map((tf, idx) => {
                          const maxQty = topFruits[0]?.totalQty || 1;
                          const pct = Math.max(8, Math.round((tf.totalQty / maxQty) * 100));
                          return (
                            <div key={idx} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'}`}>
                                    #{idx + 1}
                                  </span>
                                  <div className="truncate">
                                    <strong className="font-extrabold block truncate">{tf.fruitName}</strong>
                                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                                      {tf.trxCount}x order • Modal {formatRp(tf.totalModal)}
                                    </span>
                                  </div>
                                </div>
                                <strong className="text-xs font-extrabold text-emerald-500 shrink-0">
                                  {tf.totalQty} {tf.unit}
                                </strong>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-black/15 overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Detail Riwayat Penjualan */}
                  <div className="space-y-2.5">
                    {salesList.map((t) => {
                      const gp = Number(t.amount) - Number(t.costAmount || 0);
                      const linkedOrder = orders.find((o) => o.id === t.orderId);
                      const itemList = t.items && t.items.length > 0 ? t.items : linkedOrder?.items || [];
                      return (
                        <div key={t.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="text-sm font-extrabold">{t.customer || t.desc}</strong>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${t.paymentStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                  {t.paymentStatus === 'paid'
                                    ? `LUNAS • ${t.paymentMethod === 'cash' ? 'CASH' : 'TRANSFER'}`
                                    : 'PIUTANG'}
                                </span>
                              </div>
                              <span style={{ color: 'var(--text-muted)' }} className="text-[11px] block mt-0.5">
                                Tgl Order: {t.date}{t.paidDate && t.paidDate !== t.date ? ` • Lunas: ${t.paidDate}` : ''}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <strong className="text-sm font-extrabold text-emerald-500 block">{formatRp(t.amount)}</strong>
                              <button onClick={() => handleDeleteTransaction(t)} className="text-[10px] text-rose-500 font-bold">
                                Hapus
                              </button>
                            </div>
                          </div>

                          <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1">
                            {itemList.map((it, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold">• {it.fruitName} <b className="text-emerald-500">({it.qty} {it.unit})</b></span>
                                <span style={{ color: 'var(--text-muted)' }}>Modal {formatRp(Number(it.qty) * Number(it.buyPrice || 0))}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ borderColor: 'var(--border-color)' }} className="flex items-center justify-between text-[11px] pt-1 border-t">
                            <span style={{ color: 'var(--text-muted)' }}>Total HPP: <b>{formatRp(t.costAmount)}</b></span>
                            <span className="text-teal-500 font-extrabold">Laba Kotor: +{formatRp(gp)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: LABA RUGI */}
              {financeSubTab === 'pnl' && (
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-4 space-y-3">
                  <div style={{ borderColor: 'var(--border-color)' }} className="flex items-center justify-between border-b pb-2.5">
                    <div>
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold uppercase block">Laba Bersih Periode</span>
                      <strong className="text-lg font-extrabold text-emerald-500">{formatRp(pnlData.net)}</strong>
                    </div>
                    <span style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }} className="px-2.5 py-1 rounded-xl text-xs font-extrabold">
                      Margin {pnlData.margin}%
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Pendapatan Penjualan</span><strong>{formatRp(pnlData.rev)}</strong></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Harga Pokok Penjualan (HPP)</span><strong className="text-rose-500">-{formatRp(pnlData.hpp)}</strong></div>
                    <div style={{ borderColor: 'var(--border-color)' }} className="flex justify-between pt-1.5 border-t"><span className="font-bold">Laba Kotor</span><strong>{formatRp(pnlData.gross)}</strong></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Biaya Operasional</span><strong className="text-rose-500">-{formatRp(pnlData.opex)}</strong></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Kerugian Out Stok (Busuk/Rusak/Tester)</span><strong className="text-rose-500">-{formatRp(pnlData.stockLoss)}</strong></div>
                    {pnlData.reval !== 0 && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Penyesuaian Nilai Modal Stok</span>
                        <strong className={pnlData.reval >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {pnlData.reval >= 0 ? '+' : ''}{formatRp(pnlData.reval)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: NERACA (STATUS DINAMIS & PENYEIMBANG OTOMATIS) */}
              {financeSubTab === 'balance' && (
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm">Posisi Neraca Usaha</span>
                    {balanceData.isBalanced ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-500">
                        SEIMBANG
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-500">
                        SELISIH {formatRp(Math.abs(balanceData.diff))}
                      </span>
                    )}
                  </div>

                  {!balanceData.isBalanced && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-2 text-[11px]">
                      <p className="text-amber-600 dark:text-amber-300 font-semibold leading-relaxed">
                        Terdapat selisih <b>{formatRp(balanceData.diff)}</b> antara Total Aktiva dan Pasiva (biasanya dari input stok awal barang sebelum pencatatan modal).
                      </p>
                      <button
                        onClick={() => syncLegacyBalanceDiff(balanceData.diff)}
                        className="w-full py-2 rounded-lg bg-amber-500 text-white font-extrabold"
                      >
                        Sesuaikan ke Modal Awal Stok Sekarang
                      </button>
                    </div>
                  )}

                  <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl space-y-1.5">
                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-extrabold uppercase block">AKTIVA (HARTA USAHA)</span>
                    <div className="flex justify-between"><span>Kas & Saldo Rekening</span><strong>{formatRp(balanceData.cash)}</strong></div>
                    <div className="flex justify-between text-[11px] pl-2"><span style={{ color: 'var(--text-muted)' }}>• Penerimaan Penjualan Transfer</span><span className="text-sky-500 font-bold">{formatRp(balanceData.paidTransferOnly)}</span></div>
                    <div className="flex justify-between text-[11px] pl-2"><span style={{ color: 'var(--text-muted)' }}>• Penerimaan Penjualan Cash</span><span className="text-emerald-500 font-bold">{formatRp(balanceData.paidCashOnly)}</span></div>
                    <div className="flex justify-between"><span>Piutang Usaha</span><strong>{formatRp(balanceData.unpaidAr)}</strong></div>
                    <div className="flex justify-between"><span>Persediaan Stok Buah</span><strong>{formatRp(balanceData.inv)}</strong></div>
                    <div style={{ borderColor: 'var(--border-color)' }} className="flex justify-between pt-1.5 border-t font-extrabold">
                      <span>Total Aktiva</span><strong className="text-emerald-500">{formatRp(balanceData.totalAssets)}</strong>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl space-y-1.5">
                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-extrabold uppercase block">PASIVA (MODAL & LABA)</span>
                    <div className="flex justify-between"><span>Modal Disetor Awal</span><strong>{formatRp(balanceData.capIn)}</strong></div>
                    <div className="flex justify-between"><span>Laba Bersih Akumulasi</span><strong>{formatRp(balanceData.net)}</strong></div>
                    <div style={{ borderColor: 'var(--border-color)' }} className="flex justify-between pt-1.5 border-t font-extrabold">
                      <span>Total Pasiva</span><strong className="text-emerald-500">{formatRp(balanceData.totalEquity)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: ARUS KAS */}
              {financeSubTab === 'cashflow' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3 space-y-1">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Kas Masuk</span>
                      <strong className="text-sm font-extrabold text-emerald-500 block">{formatRp(cashflowData.cfIn)}</strong>
                      <div className="text-[10px] flex justify-between pt-1 opacity-85">
                        <span>Transfer: <b>{formatRp(cashflowData.cfInTransfer)}</b></span>
                        <span>Cash: <b>{formatRp(cashflowData.cfInCash)}</b></span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3 space-y-1">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Kas Keluar</span>
                      <strong className="text-sm font-extrabold text-rose-500 block">{formatRp(cashflowData.cfOut)}</strong>
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block pt-1">Belanja Stok & Operasional</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {cashflowData.items.map((t) => (
                      <div key={t.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3 flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong>{t.desc}</strong>
                            {t.paymentMethod && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${t.paymentMethod === 'cash' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-sky-500/15 text-sky-500'}`}>
                                {t.paymentMethod === 'cash' ? 'CASH' : 'TRANSFER'}
                              </span>
                            )}
                          </div>
                          <span style={{ color: 'var(--text-muted)' }} className="text-[11px] block mt-0.5">{t.effectiveDate}</span>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <strong className={`block ${t.dir === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.dir === 'in' ? '+' : '-'}{formatRp(t.amount)}
                          </strong>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditFinanceTrx(t)}
                              style={{ backgroundColor: 'var(--bg-card-sub)' }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(t)}
                              className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[10px] font-bold"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cashflowData.nonCashCapItems.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-extrabold uppercase block">
                        Catatan Modal Awal Barang (Non-Tunai)
                      </span>
                      {cashflowData.nonCashCapItems.map((t) => (
                        <div key={t.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3 flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <strong>{t.desc}</strong>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/15 text-amber-500">
                                MODAL BARANG
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-muted)' }} className="text-[11px] block mt-0.5">{t.date}</span>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <strong className="text-amber-500 block">{formatRp(t.amount)}</strong>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditFinanceTrx(t)}
                                style={{ backgroundColor: 'var(--bg-card-sub)' }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(t)}
                                className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[10px] font-bold"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </main>

        {/* FLOATING ACTION BUTTON (+ ORDER BARU) */}
        <button
          onClick={() => openOrderSheet('single')}
          style={{ backgroundColor: 'var(--accent)' }}
          className="fixed bottom-20 right-4 sm:right-[calc(50%-204px)] z-30 px-4 py-3 rounded-full text-white shadow-lg text-xs font-extrabold"
        >
          + Order Baru
        </button>

        {/* BOTTOM NAVIGATION DENGAN IKON */}
        <nav
          style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border-color)' }}
          className="fixed bottom-0 w-full max-w-[440px] border-t backdrop-blur-md z-30 grid grid-cols-5 py-1.5 px-1 text-[10px] font-bold"
        >
          {[
            { id: 'home', label: 'Beranda' },
            { id: 'stock', label: 'Stok' },
            { id: 'orders', label: 'Order' },
            { id: 'receivables', label: 'Piutang' },
            { id: 'finance', label: 'Keuangan' }
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setCurrentView(n.id)}
              style={
                currentView === n.id
                  ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }
                  : { color: 'var(--text-muted)' }
              }
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl font-extrabold transition-colors"
            >
              <NavIcon id={n.id} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* ================= MODAL AKUN TERDAFTAR ================= */}
        {accountModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Akun Terdaftar MFruits</h3>
                <button onClick={() => setAccountModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <div className="space-y-3 text-xs">
                <div style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }} className="p-3 rounded-2xl space-y-1">
                  <span className="font-extrabold block">✅ Akses Resmi Terverifikasi</span>
                  <p className="font-semibold">{user.email}</p>
                  <p className="text-[11px] opacity-85">Seluruh perubahan data otomatis tersinkronisasi untuk semua email terdaftar di MFruits.</p>
                </div>
                <button
                  onClick={handleLogoutGoogle}
                  className="w-full py-2.5 rounded-xl bg-rose-500/15 text-rose-500 font-extrabold"
                >
                  Keluar (Logout)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 1: TAMBAH / EDIT BUAH ================= */}
        {fruitModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">{fruitForm.id ? 'Edit Stok Buah' : 'Tambah Buah Baru'}</h3>
                <button onClick={() => setFruitModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <form onSubmit={saveFruitForm} className="space-y-3 text-xs">
                <div>
                  <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Nama Buah</label>
                  <input required placeholder="Contoh: Anggur Muscat / Apel Fuji" value={fruitForm.name} onChange={(e) => setFruitForm({ ...fruitForm, name: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Satuan Kemasan</label>
                    <select
                      value={UNIT_OPTIONS.includes(fruitForm.unit) ? fruitForm.unit : 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFruitForm({ ...fruitForm, unit: val === 'custom' ? '' : val });
                      }}
                      style={{ backgroundColor: 'var(--bg-card-sub)' }}
                      className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                    >
                      <option value="kg">kg (Kilogram)</option>
                      <option value="pack">pack (Kemasan Pack)</option>
                      <option value="500gr">500gr</option>
                      <option value="pcs">pcs / buah</option>
                      <option value="box">box / dus</option>
                      <option value="ikat">ikat</option>
                      <option value="custom">Lainnya (Ketik manual)...</option>
                    </select>
                    {!UNIT_OPTIONS.includes(fruitForm.unit) && (
                      <input
                        required
                        placeholder="Ketik satuan (misal: 250gr)"
                        value={fruitForm.unit}
                        onChange={(e) => setFruitForm({ ...fruitForm, unit: e.target.value })}
                        style={{ backgroundColor: 'var(--bg-card-sub)' }}
                        className="w-full px-3 py-2 rounded-xl mt-1.5 outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Stok Saat Ini ({fruitForm.unit || 'kg'})</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      placeholder="Stok (misal: 1.25)"
                      value={fruitForm.stock}
                      onChange={(e) => setFruitForm({ ...fruitForm, stock: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-card-sub)' }}
                      className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                    />
                    {fruitForm.unit === 'kg' && Number(fruitForm.stock) > 0 && (
                      <span className="text-[10px] text-emerald-500 font-semibold block mt-1">
                        {formatWeightDetail(fruitForm.stock, 'kg')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Harga Modal per {fruitForm.unit || 'Satuan'}</label>
                    <input required type="number" placeholder="Harga Modal (Rp)" value={fruitForm.buyPrice} onChange={(e) => setFruitForm({ ...fruitForm, buyPrice: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold" />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Harga Jual per {fruitForm.unit || 'Satuan'}</label>
                    <input required type="number" placeholder="Harga Jual (Rp)" value={fruitForm.sellPrice} onChange={(e) => setFruitForm({ ...fruitForm, sellPrice: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold" />
                  </div>
                </div>

                {!fruitForm.id && Number(fruitForm.stock) > 0 && (
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Asal Dana Stok Awal Ini</label>
                    <select
                      value={fruitForm.stockSource}
                      onChange={(e) => setFruitForm({ ...fruitForm, stockSource: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-card-sub)' }}
                      className="w-full px-3 py-2.5 rounded-xl font-semibold outline-none"
                    >
                      <option value="capital">Modal Awal Barang (Masuk ke Modal Disetor)</option>
                      <option value="cash">Dibeli dari Kas Toko (Mengurangi Kas)</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {fruitForm.id && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteFruit(fruitForm.id);
                        setFruitModalOpen(false);
                      }}
                      className="px-4 py-3 rounded-xl bg-rose-500/15 text-rose-500 font-extrabold"
                    >
                      Hapus
                    </button>
                  )}
                  <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="flex-1 py-3 rounded-xl text-white font-extrabold">
                    Simpan Data Buah
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL BARU: BUAT / EDIT PRODUK PAKET BUNDLING ================= */}
        {bundleCatalogModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base">{bundleCatalogForm.id ? 'Edit Paket Bundling' : 'Buat Produk Paket Bundling'}</h3>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Simpan template paket agar siap dipilih saat Order Bundling</p>
                </div>
                <button onClick={() => setBundleCatalogModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>

              <form onSubmit={saveBundleCatalogForm} className="space-y-3 text-xs">
                <div>
                  <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Nama Produk Paket Bundling</label>
                  <input
                    required
                    placeholder="Contoh: Paket Parsel Sehat A / Hampers Buah"
                    value={bundleCatalogForm.name}
                    onChange={(e) => setBundleCatalogForm({ ...bundleCatalogForm, name: e.target.value })}
                    style={{ backgroundColor: 'var(--bg-card-sub)' }}
                    className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Komposisi Buah per 1 Paket</span>
                    <button
                      type="button"
                      onClick={() => {
                        const f = fruits[0];
                        if (!f) return showToast('Tambahkan data buah di Stok terlebih dahulu.');
                        setBundleCatalogForm({
                          ...bundleCatalogForm,
                          items: [
                            ...bundleCatalogForm.items,
                            {
                              fruitId: f.id,
                              fruitName: f.name,
                              qty: f.unit === 'kg' ? 0.5 : 1,
                              unit: f.unit,
                              buyPrice: f.buyPrice,
                              sellPrice: f.sellPrice
                            }
                          ]
                        });
                      }}
                      className="text-emerald-500 font-extrabold"
                    >
                      + Tambah Buah
                    </button>
                  </div>

                  {bundleCatalogForm.items.map((it, idx) => (
                    <div key={idx} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={it.fruitId}
                          onChange={(e) => {
                            const f = fruits.find((item) => item.id === e.target.value);
                            if (!f) return;
                            const copy = [...bundleCatalogForm.items];
                            copy[idx] = {
                              fruitId: f.id,
                              fruitName: f.name,
                              qty: copy[idx].qty,
                              unit: f.unit,
                              buyPrice: f.buyPrice,
                              sellPrice: f.sellPrice
                            };
                            setBundleCatalogForm({ ...bundleCatalogForm, items: copy });
                          }}
                          style={{ backgroundColor: 'var(--bg-card)' }}
                          className="flex-1 px-2 py-1.5 rounded-lg font-semibold outline-none"
                        >
                          {fruits.map((f) => (
                            <option key={f.id} value={f.id}>{f.name} ({formatRp(f.buyPrice)}/{f.unit})</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={it.qty}
                          onChange={(e) => {
                            const copy = [...bundleCatalogForm.items];
                            copy[idx].qty = Number(e.target.value) || 0;
                            setBundleCatalogForm({ ...bundleCatalogForm, items: copy });
                          }}
                          style={{ backgroundColor: 'var(--bg-card)' }}
                          className="w-20 px-2 py-1.5 rounded-lg text-center font-bold outline-none"
                        />
                        <span className="text-[11px] w-10 truncate font-semibold">{it.unit}</span>
                        {bundleCatalogForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBundleCatalogForm({
                                ...bundleCatalogForm,
                                items: bundleCatalogForm.items.filter((_, i) => i !== idx)
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 font-bold"
                          >
                            x
                          </button>
                        )}
                      </div>
                      {it.unit === 'kg' && Number(it.qty) > 0 && (
                        <div className="flex items-center justify-between text-[10px] px-1">
                          <span className="text-emerald-500 font-semibold">{formatWeightDetail(it.qty, 'kg')}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...bundleCatalogForm.items];
                                copy[idx].qty = Number((Number(copy[idx].qty || 0) + 0.25).toFixed(2));
                                setBundleCatalogForm({ ...bundleCatalogForm, items: copy });
                              }}
                              style={{ backgroundColor: 'var(--bg-card)' }}
                              className="px-1.5 py-0.5 rounded font-bold"
                            >
                              +250gr
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...bundleCatalogForm.items];
                                copy[idx].qty = Number((Number(copy[idx].qty || 0) + 0.5).toFixed(2));
                                setBundleCatalogForm({ ...bundleCatalogForm, items: copy });
                              }}
                              style={{ backgroundColor: 'var(--bg-card)' }}
                              className="px-1.5 py-0.5 rounded font-bold"
                            >
                              +500gr
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl">
                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Total Modal Isi Paket</span>
                    <strong className="text-sm font-extrabold">{formatRp(bundleCatalogModalCost)}</strong>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Harga Jual Paket (Rp)</label>
                    <input
                      type="number"
                      required
                      placeholder="Contoh: 85000"
                      value={bundleCatalogForm.sellPrice}
                      onChange={(e) => setBundleCatalogForm({ ...bundleCatalogForm, sellPrice: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-card-sub)' }}
                      className="w-full px-3 py-2 rounded-xl font-bold outline-none"
                    />
                  </div>
                </div>

                <input
                  placeholder="Deskripsi / Kemasan (Contoh: Box mika + pita ucapan)"
                  value={bundleCatalogForm.desc}
                  onChange={(e) => setBundleCatalogForm({ ...bundleCatalogForm, desc: e.target.value })}
                  style={{ backgroundColor: 'var(--bg-card-sub)' }}
                  className="w-full px-3 py-2.5 rounded-xl outline-none"
                />

                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Produk Paket Bundling
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 2: BELANJA STOK MULTI-ITEM ================= */}
        {bulkModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Input Belanja Stok Sekaligus</h3>
                <button onClick={() => setBulkModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <form onSubmit={saveBulkRestockForm} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2 rounded-xl outline-none" />
                  <select value={bulkPayMethod} onChange={(e) => setBulkPayMethod(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2 rounded-xl font-bold outline-none">
                    <option value="cash">Bayar Cash</option>
                    <option value="transfer">Bayar Transfer</option>
                  </select>
                </div>
                <input placeholder="Supplier / Catatan Belanja (Opsional)" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2 rounded-xl outline-none" />

                <div className="flex justify-between items-center">
                  <span className="font-bold">Daftar Buah Dibeli</span>
                  <button
                    type="button"
                    onClick={() => setBulkRows([...bulkRows, { fruitId: 'NEW', customName: '', unit: 'kg', qty: 1, buyPrice: '', sellPrice: '' }])}
                    className="text-emerald-500 font-extrabold"
                  >
                    + Tambah Baris
                  </button>
                </div>

                {bulkRows.map((r, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={r.fruitId}
                        onChange={(e) => {
                          const val = e.target.value;
                          const copy = [...bulkRows];
                          if (val === 'NEW') {
                            copy[idx] = { fruitId: 'NEW', customName: '', unit: 'kg', qty: 1, buyPrice: '', sellPrice: '' };
                          } else {
                            const f = fruits.find((item) => item.id === val);
                            copy[idx] = { ...copy[idx], fruitId: val, unit: f.unit, buyPrice: f.buyPrice, sellPrice: f.sellPrice };
                          }
                          setBulkRows(copy);
                        }}
                        style={{ backgroundColor: 'var(--bg-card)' }}
                        className="flex-1 px-2.5 py-2 rounded-xl font-bold outline-none"
                      >
                        <option value="NEW">+ Ketik Buah Jenis Baru...</option>
                        {fruits.map((f) => (
                          <option key={f.id} value={f.id}>{f.name} ({f.unit} • Stok: {f.stock})</option>
                        ))}
                      </select>
                      {bulkRows.length > 1 && (
                        <button type="button" onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))} className="px-2 rounded-lg bg-rose-500/15 text-rose-500 font-bold">
                          x
                        </button>
                      )}
                    </div>

                    {r.fruitId === 'NEW' && (
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          required
                          placeholder="Nama buah baru"
                          value={r.customName}
                          onChange={(e) => {
                            const c = [...bulkRows];
                            c[idx].customName = e.target.value;
                            setBulkRows(c);
                          }}
                          style={{ backgroundColor: 'var(--bg-card)' }}
                          className="col-span-2 px-2.5 py-2 rounded-xl outline-none"
                        />
                        <select
                          value={r.unit || 'kg'}
                          onChange={(e) => {
                            const c = [...bulkRows];
                            c[idx].unit = e.target.value;
                            setBulkRows(c);
                          }}
                          style={{ backgroundColor: 'var(--bg-card)' }}
                          className="px-2 py-2 rounded-xl font-bold outline-none"
                        >
                          <option value="kg">kg</option>
                          <option value="pack">pack</option>
                          <option value="500gr">500gr</option>
                          <option value="pcs">pcs</option>
                          <option value="box">box</option>
                          <option value="ikat">ikat</option>
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      <input type="number" step="0.01" required placeholder={`Qty (${r.unit || 'kg'})`} value={r.qty} onChange={(e) => { const c = [...bulkRows]; c[idx].qty = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-1.5 rounded-xl font-bold outline-none" />
                      <input type="number" required placeholder="Harga Beli" value={r.buyPrice} onChange={(e) => { const c = [...bulkRows]; c[idx].buyPrice = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-1.5 rounded-xl font-bold outline-none" />
                      <input type="number" placeholder="Harga Jual" value={r.sellPrice} onChange={(e) => { const c = [...bulkRows]; c[idx].sellPrice = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-1.5 rounded-xl font-bold outline-none" />
                    </div>
                    {r.unit === 'kg' && Number(r.qty) > 0 && (
                      <span className="text-[10px] text-emerald-500 font-semibold block">
                        {formatWeightDetail(r.qty, 'kg')}
                      </span>
                    )}
                  </div>
                ))}

                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Belanja & Update Stok
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL OUT STOCK NON-PENJUALAN ================= */}
        {outStockModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base">Out Stok (Non-Penjualan)</h3>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Pengeluaran stok buah busuk, rusak, tester, atau susut</p>
                </div>
                <button onClick={() => setOutStockModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>

              <form onSubmit={saveOutStockForm} className="space-y-3 text-xs">
                <div>
                  <label style={{ color: 'var(--text-muted)' }} className="font-bold block mb-1">Pilih Buah</label>
                  <select
                    required
                    value={outStockForm.fruitId}
                    onChange={(e) => setOutStockForm({ ...outStockForm, fruitId: e.target.value })}
                    style={{ backgroundColor: 'var(--bg-card-sub)' }}
                    className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                  >
                    <option value="">-- Pilih Buah --</option>
                    {fruits.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (Stok: {f.stock} {f.unit} • Modal {formatRp(f.buyPrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="font-bold block mb-1">Jumlah Keluar</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="Misal: 0.35"
                      value={outStockForm.qty}
                      onChange={(e) => setOutStockForm({ ...outStockForm, qty: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-card-sub)' }}
                      className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)' }} className="font-bold block mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={outStockForm.date}
                      onChange={(e) => setOutStockForm({ ...outStockForm, date: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-card-sub)' }}
                      className="w-full px-3 py-2.5 rounded-xl font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ color: 'var(--text-muted)' }} className="font-bold block mb-1">Alasan Pengeluaran</label>
                  <select
                    value={outStockForm.reason}
                    onChange={(e) => setOutStockForm({ ...outStockForm, reason: e.target.value })}
                    style={{ backgroundColor: 'var(--bg-card-sub)' }}
                    className="w-full px-3 py-2.5 rounded-xl font-semibold outline-none"
                  >
                    <option value="Buah Busuk / Rusak">Buah Busuk / Rusak (Tidak Layak Jual)</option>
                    <option value="Tester / Sample Pelanggan">Tester / Sample Pelanggan</option>
                    <option value="Susut Timbangan / Sortir">Susut Timbangan / Sortir</option>
                    <option value="Konsumsi Pribadi / Hadiah">Konsumsi Pribadi / Hadiah</option>
                  </select>
                </div>

                <div>
                  <label style={{ color: 'var(--text-muted)' }} className="font-bold block mb-1">Keterangan Tambahan (Opsional)</label>
                  <input
                    placeholder="Contoh: Penyok pengiriman / buah terlalu matang"
                    value={outStockForm.note}
                    onChange={(e) => setOutStockForm({ ...outStockForm, note: e.target.value })}
                    style={{ backgroundColor: 'var(--bg-card-sub)' }}
                    className="w-full px-3 py-2.5 rounded-xl outline-none"
                  />
                </div>

                {(() => {
                  const sel = fruits.find((f) => f.id === outStockForm.fruitId);
                  const loss = sel ? (Number(outStockForm.qty) || 0) * Number(sel.buyPrice || 0) : 0;
                  return (
                    <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl flex items-center justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Nilai Modal Dikeluarkan (Beban Kerugian):</span>
                      <strong className="text-rose-500">{formatRp(loss)}</strong>
                    </div>
                  );
                })()}

                <button type="submit" className="w-full py-3 rounded-xl bg-rose-600 text-white font-extrabold shadow">
                  Keluarkan Stok Sekarang
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 3: ORDER SATUAN (MULTI-BUAH) & ORDER BUNDLING ================= */}
        {orderSheetOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Catat Order Pelanggan</h3>
                <button onClick={() => setOrderSheetOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="grid grid-cols-2 gap-1.5 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setOrderMode('single');
                    setOrderCustomSell('');
                  }}
                  style={orderMode === 'single' ? { backgroundColor: 'var(--accent)', color: '#fff' } : {}}
                  className="py-2 rounded-lg transition-all"
                >
                  Order Satuan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderMode('bundle');
                    setOrderCustomSell('');
                    if (!selectedBundleId && bundles[0]) setSelectedBundleId(bundles[0].id);
                  }}
                  style={orderMode === 'bundle' ? { backgroundColor: 'var(--accent)', color: '#fff' } : {}}
                  className="py-2 rounded-lg transition-all"
                >
                  Order Bundling
                </button>
              </div>

              <form onSubmit={saveOrderSheet} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="Nama Pelanggan" value={orderCustomer} onChange={(e) => setOrderCustomer(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold" />
                  <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold">
                    <option value="confirmed">Pesanan Pasti (Deal)</option>
                    <option value="request">Masih Request</option>
                  </select>
                </div>

                {orderMode === 'single' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Daftar Buah Dibeli (Non-Paket)</span>
                      <button
                        type="button"
                        onClick={() => {
                          const f = fruits[0];
                          if (!f) return showToast('Belum ada data buah di Stok.');
                          setSingleOrderItems([
                            ...singleOrderItems,
                            {
                              fruitId: f.id,
                              fruitName: f.name,
                              qty: 1,
                              unit: f.unit,
                              buyPrice: f.buyPrice,
                              sellPrice: f.sellPrice
                            }
                          ]);
                        }}
                        className="text-emerald-500 font-extrabold"
                      >
                        + Tambah Buah
                      </button>
                    </div>

                    {singleOrderItems.map((it, idx) => (
                      <div key={idx} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={it.fruitId}
                            onChange={(e) => {
                              const f = fruits.find((item) => item.id === e.target.value);
                              if (!f) return;
                              const copy = [...singleOrderItems];
                              copy[idx] = {
                                fruitId: f.id,
                                fruitName: f.name,
                                qty: copy[idx].qty,
                                unit: f.unit,
                                buyPrice: f.buyPrice,
                                sellPrice: f.sellPrice
                              };
                              setSingleOrderItems(copy);
                            }}
                            style={{ backgroundColor: 'var(--bg-card)' }}
                            className="flex-1 px-2 py-1.5 rounded-lg font-semibold outline-none"
                          >
                            {fruits.map((f) => (
                              <option key={f.id} value={f.id}>{f.name} ({formatRp(f.sellPrice)}/{f.unit})</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={it.qty}
                            onChange={(e) => {
                              const copy = [...singleOrderItems];
                              copy[idx].qty = Number(e.target.value) || 0;
                              setSingleOrderItems(copy);
                            }}
                            style={{ backgroundColor: 'var(--bg-card)' }}
                            className="w-20 px-2 py-1.5 rounded-lg text-center font-bold outline-none"
                          />
                          <span className="text-[11px] w-10 truncate font-semibold">{it.unit}</span>
                          {singleOrderItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSingleOrderItems(singleOrderItems.filter((_, i) => i !== idx))}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 font-bold"
                            >
                              x
                            </button>
                          )}
                        </div>

                        {it.unit === 'kg' && Number(it.qty) > 0 && (
                          <div className="flex items-center justify-between text-[10px] px-1">
                            <span className="text-emerald-500 font-semibold">{formatWeightDetail(it.qty, 'kg')}</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...singleOrderItems];
                                  copy[idx].qty = Number((Number(copy[idx].qty || 0) + 0.25).toFixed(2));
                                  setSingleOrderItems(copy);
                                }}
                                style={{ backgroundColor: 'var(--bg-card)' }}
                                className="px-1.5 py-0.5 rounded font-bold"
                              >
                                +250gr
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...singleOrderItems];
                                  copy[idx].qty = Number((Number(copy[idx].qty || 0) + 0.5).toFixed(2));
                                  setSingleOrderItems(copy);
                                }}
                                style={{ backgroundColor: 'var(--bg-card)' }}
                                className="px-1.5 py-0.5 rounded font-bold"
                              >
                                +500gr
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div>
                      <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Harga Jual Total (Kosongkan = Otomatis sesuai harga jual)</label>
                      <input type="number" placeholder={`Otomatis: ${formatRp(orderCalc.finalSell)}`} value={orderCustomSell} onChange={(e) => setOrderCustomSell(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {bundles.length === 0 ? (
                      <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3.5 rounded-xl text-center space-y-2">
                        <p className="font-bold text-amber-500">Belum ada Produk Paket Bundling</p>
                        <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                          Buat produk paket bundling terlebih dahulu agar bisa dipilih di sini.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setOrderSheetOpen(false);
                            setCurrentView('stock');
                            setStockFilter('bundles');
                            openBundleCatalogModal(null);
                          }}
                          style={{ backgroundColor: 'var(--accent)' }}
                          className="px-3 py-2 rounded-xl text-white font-extrabold text-[11px]"
                        >
                          + Buat Produk Bundling Sekarang
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold">Pilih Produk Paket Bundling</label>
                            <button
                              type="button"
                              onClick={() => {
                                setOrderSheetOpen(false);
                                setCurrentView('stock');
                                setStockFilter('bundles');
                                openBundleCatalogModal(null);
                              }}
                              className="text-[10px] text-emerald-500 font-extrabold"
                            >
                              + Paket Baru
                            </button>
                          </div>
                          <select
                            required
                            value={selectedBundleId}
                            onChange={(e) => {
                              setSelectedBundleId(e.target.value);
                              setOrderCustomSell('');
                            }}
                            style={{ backgroundColor: 'var(--bg-card-sub)' }}
                            className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                          >
                            {bundles.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} — {formatRp(b.sellPrice)} / paket
                              </option>
                            ))}
                          </select>
                        </div>

                        {activeSelectedBundle && (
                          <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1">
                            <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold uppercase block">
                              Isi per 1 Paket ({activeSelectedBundle.name}):
                            </span>
                            {(activeSelectedBundle.items || []).map((it, idx) => (
                              <div key={idx} className="flex justify-between text-[11px]">
                                <span>• {it.fruitName}</span>
                                <strong>{Number((Number(it.qty || 0) * (Number(bundleOrderQty) || 1)).toFixed(3))} {it.unit}</strong>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Jumlah Paket</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              value={bundleOrderQty}
                              onChange={(e) => setBundleOrderQty(e.target.value)}
                              style={{ backgroundColor: 'var(--bg-card-sub)' }}
                              className="w-full px-3 py-2.5 rounded-xl font-bold outline-none"
                            />
                          </div>
                          <div>
                            <label style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block mb-1">Harga Jual Final (Custom)</label>
                            <input
                              type="number"
                              placeholder={`Otomatis: ${formatRp(orderCalc.finalSell)}`}
                              value={orderCustomSell}
                              onChange={(e) => setOrderCustomSell(e.target.value)}
                              style={{ backgroundColor: 'var(--bg-card-sub)' }}
                              className="w-full px-3 py-2.5 rounded-xl font-semibold outline-none"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl flex justify-between">
                  <div><span className="text-[10px] block">Modal</span><strong>{formatRp(orderCalc.totalCost)}</strong></div>
                  <div><span className="text-[10px] block">Harga Jual</span><strong className="text-emerald-500">{formatRp(orderCalc.finalSell)}</strong></div>
                  <div><span className="text-[10px] block">Est. Laba</span><strong className="text-teal-500">{formatRp(orderCalc.profit)}</strong></div>
                </div>

                <input placeholder="Catatan Order (Opsional)" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />

                <button
                  type="submit"
                  disabled={orderMode === 'bundle' && bundles.length === 0}
                  style={{ backgroundColor: 'var(--accent)' }}
                  className="w-full py-3 rounded-xl text-white font-extrabold disabled:opacity-50"
                >
                  Simpan Order
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 4: SELESAIKAN ORDER (PILIH TRANSFER / CASH) ================= */}
        {completeOrderTarget && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Selesaikan Order</h3>
                <button onClick={() => setCompleteOrderTarget(null)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <p className="text-xs">{completeOrderTarget.customer} • Total Tagihan <b>{formatRp(completeOrderTarget.totalSell)}</b></p>

              <div className="text-xs space-y-1">
                <label className="font-bold block">Tanggal Selesai / Pembayaran</label>
                <input type="date" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl font-semibold outline-none" />
              </div>

              <div className="text-xs space-y-1.5">
                <label className="font-bold block">Metode Pembayaran (Jika Lunas)</label>
                <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="grid grid-cols-2 gap-1.5 p-1 rounded-xl font-extrabold">
                  <button
                    type="button"
                    onClick={() => setCompletePayMethod('transfer')}
                    className={`py-2 rounded-lg transition-all ${
                      completePayMethod === 'transfer' ? 'bg-sky-600 text-white shadow-xs' : 'opacity-70'
                    }`}
                  >
                    🏦 Transfer Bank / QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletePayMethod('cash')}
                    className={`py-2 rounded-lg transition-all ${
                      completePayMethod === 'cash' ? 'bg-emerald-600 text-white shadow-xs' : 'opacity-70'
                    }`}
                  >
                    💵 Tunai (Cash)
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button onClick={() => confirmCompleteOrder('paid')} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
                  Lunas ({completePayMethod === 'cash' ? 'Cash' : 'Transfer'}) & Potong Stok
                </button>
                <button onClick={() => confirmCompleteOrder('unpaid')} className="w-full py-3 rounded-xl bg-amber-500 text-white font-extrabold text-xs">
                  Belum Bayar (Masukkan ke Tab Piutang)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 5: TAMBAH REKENING ================= */}
        {bankModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Tambah Rekening</h3>
                <button onClick={() => setBankModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <form onSubmit={saveBankForm} className="space-y-3 text-xs">
                <input required placeholder="Nama Bank / E-Wallet" value={bankForm.bank} onChange={(e) => setBankForm({ ...bankForm, bank: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <input required placeholder="Nomor Rekening / HP" value={bankForm.number} onChange={(e) => setBankForm({ ...bankForm, number: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <input required placeholder="Atas Nama" value={bankForm.holder} onChange={(e) => setBankForm({ ...bankForm, holder: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Rekening
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 6: CATAT / EDIT TRANSAKSI KEUANGAN ================= */}
        {financeModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">{financeForm.id ? 'Edit Transaksi Kas' : 'Catat Transaksi Keuangan'}</h3>
                <button onClick={() => setFinanceModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <form onSubmit={saveFinanceForm} className="space-y-3 text-xs">
                {financeForm.type === 'sale' ? (
                  <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="px-3 py-2.5 rounded-xl font-bold text-emerald-500">
                    Jenis: Penerimaan Penjualan
                  </div>
                ) : (
                  <select value={financeForm.type} onChange={(e) => setFinanceForm({ ...financeForm, type: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none font-semibold">
                    <option value="opex">Biaya Operasional (Plastik, Mika, Pita, Ongkir)</option>
                    <option value="capital">Setoran Modal (Tunai / Barang)</option>
                    <option value="inventory_buy">Belanja Stok Buah (Masuk Persediaan)</option>
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" required value={financeForm.date} onChange={(e) => setFinanceForm({ ...financeForm, date: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                  <select value={financeForm.payMethod} onChange={(e) => setFinanceForm({ ...financeForm, payMethod: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl font-bold outline-none">
                    <option value="transfer">Transfer</option>
                    <option value="cash">Cash (Tunai)</option>
                    {financeForm.type === 'capital' && <option value="inventory">Modal Barang (Non-Tunai)</option>}
                  </select>
                </div>
                <input required placeholder="Keterangan" value={financeForm.desc} onChange={(e) => setFinanceForm({ ...financeForm, desc: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <input type="number" required placeholder="Nominal (Rp)" value={financeForm.amount} onChange={(e) => setFinanceForm({ ...financeForm, amount: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  {financeForm.id ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
