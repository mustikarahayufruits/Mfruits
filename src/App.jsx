import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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
// 1. KONFIGURASI FIREBASE (OTOMATIS MEMBACA ENVIRONMENT VARIABLES VERCEL)
// ============================================================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'buahsegar-mobile-v1';

// ============================================================================
// 2. DATA DEFAULT & HELPER
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

const DEFAULT_DATA = {
  fruits: [
    { id: 'f1', name: 'Sunkist Navel Aust', unit: 'kg', buyPrice: 38000, sellPrice: 48000, stock: 3.5, minStock: 1.5 },
    { id: 'f2', name: 'Pear Forelle', unit: 'pax (isi 6)', buyPrice: 32000, sellPrice: 42000, stock: 4, minStock: 2 },
    { id: 'f3', name: 'Pir Century', unit: 'kg', buyPrice: 30000, sellPrice: 38000, stock: 4.5, minStock: 2 },
    { id: 'f4', name: 'Klengkeng Gold', unit: '500gr', buyPrice: 22000, sellPrice: 28000, stock: 3, minStock: 2 },
    { id: 'f5', name: 'Rock Melon', unit: 'kg', buyPrice: 25000, sellPrice: 33000, stock: 2.5, minStock: 1.5 },
    { id: 'f6', name: 'NasHon', unit: 'pc', buyPrice: 25000, sellPrice: 33000, stock: 2, minStock: 2 },
    { id: 'f7', name: 'Jeruk Santang', unit: 'kg', buyPrice: 28000, sellPrice: 36000, stock: 0, minStock: 1.5 },
    { id: 'f8', name: 'Anggur Muscat', unit: '500gr', buyPrice: 35000, sellPrice: 45000, stock: 0, minStock: 2 },
    { id: 'f9', name: 'Apel Fuji Premium', unit: 'kg', buyPrice: 34000, sellPrice: 44000, stock: 0, minStock: 1.5 }
  ],
  orders: [
    {
      id: 'o1',
      customer: 'Pelanggan 1 (WA)',
      status: 'confirmed',
      paymentStatus: 'unpaid',
      notes: 'Jeruk Santang 1kg',
      items: [{ fruitId: 'f7', fruitName: 'Jeruk Santang', qty: 1, unit: 'kg', buyPrice: 28000, sellPrice: 36000 }],
      totalCost: 28000,
      totalSell: 36000
    },
    {
      id: 'o2',
      customer: 'Pelanggan 2 (2 Paket Bundling)',
      status: 'confirmed',
      paymentStatus: 'unpaid',
      notes: 'Bundling Pir 1kg, Anggur Muscat 500gr, Klengkeng 500gr (x2)',
      items: [
        { fruitId: 'f3', fruitName: 'Pir Century', qty: 2, unit: 'kg', buyPrice: 30000, sellPrice: 38000 },
        { fruitId: 'f8', fruitName: 'Anggur Muscat', qty: 2, unit: '500gr', buyPrice: 35000, sellPrice: 45000 },
        { fruitId: 'f4', fruitName: 'Klengkeng Gold', qty: 2, unit: '500gr', buyPrice: 22000, sellPrice: 28000 }
      ],
      totalCost: 174000,
      totalSell: 222000
    },
    {
      id: 'o3',
      customer: 'Request A (Pir-Anggur-Jeruk)',
      status: 'request',
      paymentStatus: 'unpaid',
      notes: 'Pir 500gr, Anggur Muscat 500gr, Jeruk Santang 500gr',
      items: [
        { fruitId: 'f3', fruitName: 'Pir Century', qty: 0.5, unit: 'kg', buyPrice: 30000, sellPrice: 38000 },
        { fruitId: 'f8', fruitName: 'Anggur Muscat', qty: 1, unit: '500gr', buyPrice: 35000, sellPrice: 45000 },
        { fruitId: 'f7', fruitName: 'Jeruk Santang', qty: 0.5, unit: 'kg', buyPrice: 28000, sellPrice: 36000 }
      ],
      totalCost: 64000,
      totalSell: 82000
    },
    {
      id: 'o4',
      customer: 'Request B (Pir-Apel-Jeruk)',
      status: 'request',
      paymentStatus: 'unpaid',
      notes: 'Pir 500gr, Apel 500gr, Jeruk 500gr',
      items: [
        { fruitId: 'f3', fruitName: 'Pir Century', qty: 0.5, unit: 'kg', buyPrice: 30000, sellPrice: 38000 },
        { fruitId: 'f9', fruitName: 'Apel Fuji Premium', qty: 0.5, unit: 'kg', buyPrice: 34000, sellPrice: 44000 },
        { fruitId: 'f7', fruitName: 'Jeruk Santang', qty: 0.5, unit: 'kg', buyPrice: 28000, sellPrice: 36000 }
      ],
      totalCost: 46000,
      totalSell: 59000
    },
    {
      id: 'o5',
      customer: 'Request C (Pir-Apel-Anggur)',
      status: 'request',
      paymentStatus: 'unpaid',
      notes: 'Pir 500gr, Apel 500gr, Anggur Muscat 500gr',
      items: [
        { fruitId: 'f3', fruitName: 'Pir Century', qty: 0.5, unit: 'kg', buyPrice: 30000, sellPrice: 38000 },
        { fruitId: 'f9', fruitName: 'Apel Fuji Premium', qty: 0.5, unit: 'kg', buyPrice: 34000, sellPrice: 44000 },
        { fruitId: 'f8', fruitName: 'Anggur Muscat', qty: 1, unit: '500gr', buyPrice: 35000, sellPrice: 45000 }
      ],
      totalCost: 67000,
      totalSell: 86000
    }
  ],
  bankAccounts: [
    { id: 'b1', bank: 'BCA', number: '8820192837', holder: 'BuahSegar Store' },
    { id: 'b2', bank: 'SeaBank / GoPay', number: '081234567890', holder: 'BuahSegar Store' }
  ],
  transactions: [
    { id: 't1', type: 'capital', date: getTodayDateStr(), desc: 'Modal Awal Usaha & Persediaan Rumah', amount: 750000 }
  ]
};

const THEME_STYLES = {
  fresh: {
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
  bento: {
    '--bg-outer': '#090d16',
    '--bg-app': '#0f172a',
    '--bg-card': '#1e293b',
    '--bg-card-sub': '#334155',
    '--text-main': '#f8fafc',
    '--text-muted': '#94a3b8',
    '--border-color': '#334155',
    '--accent': '#84cc16',
    '--accent-soft': 'rgba(132, 204, 22, 0.15)',
    '--accent-text': '#a3e635',
    '--header-grad': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    '--nav-bg': 'rgba(30, 41, 59, 0.96)'
  },
  pastel: {
    '--bg-outer': '#f5ebe0',
    '--bg-app': '#fffbf7',
    '--bg-card': '#ffffff',
    '--bg-card-sub': '#fef3c7',
    '--text-main': '#431407',
    '--text-muted': '#9a3412',
    '--border-color': '#fed7aa',
    '--accent': '#ea580c',
    '--accent-soft': '#ffedd5',
    '--accent-text': '#c2410c',
    '--header-grad': 'linear-gradient(135deg, #f97316 0%, #fb7185 100%)',
    '--nav-bg': 'rgba(255, 251, 247, 0.96)'
  }
};

// ============================================================================
// 3. KOMPONEN UTAMA APLIKASI
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loadingDb, setLoadingDb] = useState(true);
  const [dbError, setDbError] = useState('');

  // Firestore collections
  const [fruits, setFruits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // UI states
  const [theme, setTheme] = useState('fresh');
  const [currentView, setCurrentView] = useState('home');
  const [stockFilter, setStockFilter] = useState('all');
  const [financeSubTab, setFinanceSubTab] = useState('sales');
  const [financePeriods, setFinancePeriods] = useState({
    sales: 'all',
    pnl: 'all',
    balance: 'all',
    cashflow: 'all'
  });
  const [toastMsg, setToastMsg] = useState('');

  // Modal states
  const [fruitModalOpen, setFruitModalOpen] = useState(false);
  const [fruitForm, setFruitForm] = useState({ id: '', name: '', unit: 'kg', stock: 0, buyPrice: '', sellPrice: '', minStock: 1 });

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(getTodayDateStr());
  const [bulkNote, setBulkNote] = useState('');
  const [bulkRows, setBulkRows] = useState([]);

  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [orderMode, setOrderMode] = useState('single');
  const [orderCustomer, setOrderCustomer] = useState('');
  const [orderStatus, setOrderStatus] = useState('confirmed');
  const [orderMult, setOrderMult] = useState(1);
  const [orderCustomSell, setOrderCustomSell] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [bundleItems, setBundleItems] = useState([]);

  const [completeOrderTarget, setCompleteOrderTarget] = useState(null);
  const [completeDate, setCompleteDate] = useState(getTodayDateStr());

  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ bank: '', number: '', holder: '' });

  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'opex', date: getTodayDateStr(), desc: '', amount: '' });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
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
  // 4. FIREBASE AUTH & REALTIME LISTENERS
  // ==========================================================================
  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      setDbError(err.message);
      setLoadingDb(false);
    });

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const base = `artifacts/${APP_ID}/users/${user.uid}`;

    const unsubFruits = onSnapshot(collection(db, `${base}/fruits`), (snap) => {
      setFruits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingDb(false);
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
      unsubOrders();
      unsubBanks();
      unsubTrx();
    };
  }, [user]);

  const userCol = (colName) => collection(db, `artifacts/${APP_ID}/users/${user.uid}/${colName}`);
  const userDoc = (colName, id) => doc(db, `artifacts/${APP_ID}/users/${user.uid}/${colName}`, id);

  // Seed / Reset Data Demo ke Firestore
  const seedDemoToFirestore = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    DEFAULT_DATA.fruits.forEach((f) => batch.set(userDoc('fruits', f.id), f));
    DEFAULT_DATA.orders.forEach((o, i) => batch.set(userDoc('orders', o.id), { ...o, createdAt: Date.now() - i * 1000 }));
    DEFAULT_DATA.bankAccounts.forEach((b) => batch.set(userDoc('bankAccounts', b.id), b));
    DEFAULT_DATA.transactions.forEach((t, i) => batch.set(userDoc('transactions', t.id), { ...t, createdAt: Date.now() - i * 1000 }));
    await batch.commit();
    showToast('Data stok & pesanan awal berhasil dimuat ke Firestore!');
  };

  // ==========================================================================
  // 5. KALKULASI METRIK UTAMA
  // ==========================================================================
  const metrics = useMemo(() => {
    const inventoryValue = fruits.reduce((s, f) => s + Number(f.stock || 0) * Number(f.buyPrice || 0), 0);
    const lowStockItems = fruits.filter((f) => Number(f.stock || 0) <= Number(f.minStock || 0));

    const demandMap = {};
    orders
      .filter((o) => o.status !== 'completed')
      .forEach((o) => {
        (o.items || []).forEach((it) => {
          const key = (it.fruitName || '').trim().toLowerCase();
          if (!demandMap[key]) demandMap[key] = { fruitName: it.fruitName, unit: it.unit, needed: 0 };
          demandMap[key].needed += Number(it.qty || 0);
        });
      });

    const shoppingList = Object.values(demandMap)
      .map((d) => {
        const fruit = fruits.find((f) => f.name.trim().toLowerCase() === d.fruitName.trim().toLowerCase());
        const stock = fruit ? Number(fruit.stock) : 0;
        const buyPrice = fruit ? Number(fruit.buyPrice) : 0;
        const deficit = Math.max(0, Number((d.needed - stock).toFixed(2)));
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
    const totalRev = allSales.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalHpp = allSales.reduce((s, t) => s + Number(t.costAmount || 0), 0);
    const totalOpex = allOpex.reduce((s, t) => s + Number(t.amount || 0), 0);
    const netProfitAll = totalRev - totalHpp - totalOpex;

    return { inventoryValue, lowStockItems, shoppingList, totalShoppingCost, netProfitAll };
  }, [fruits, orders, transactions]);

  // ==========================================================================
  // 6. AKSI STOK & BELANJA
  // ==========================================================================
  const adjustStock = async (fruitId, delta, recordPurchase) => {
    const f = fruits.find((item) => item.id === fruitId);
    if (!f || !user) return;
    const newStock = Math.max(0, Number((Number(f.stock) + delta).toFixed(2)));
    await updateDoc(userDoc('fruits', fruitId), { stock: newStock });

    if (recordPurchase && delta > 0) {
      const cost = delta * Number(f.buyPrice);
      const tId = 't_' + Date.now();
      await setDoc(userDoc('transactions', tId), {
        id: tId,
        type: 'inventory_buy',
        date: getTodayDateStr(),
        desc: `Beli Stok ${f.name} (${delta} ${f.unit})`,
        amount: cost,
        createdAt: Date.now()
      });
      showToast(`Stok ${f.name} +${delta} ${f.unit} (Persediaan +${formatRp(cost)})`);
    } else {
      showToast(`Stok ${f.name} sekarang ${newStock} ${f.unit}`);
    }
  };

  const buyAllShoppingItems = async () => {
    if (!user || metrics.shoppingList.length === 0) return;
    const batch = writeBatch(db);
    let totalSpent = 0;

    metrics.shoppingList.forEach((item) => {
      const fruit = fruits.find((f) => f.id === item.fruitId);
      if (fruit) {
        const qty = Math.ceil(item.deficit * 2) / 2;
        batch.update(userDoc('fruits', fruit.id), {
          stock: Number((Number(fruit.stock) + qty).toFixed(2))
        });
        totalSpent += qty * Number(fruit.buyPrice);
      }
    });

    if (totalSpent > 0) {
      const tId = 't_' + Date.now();
      batch.set(userDoc('transactions', tId), {
        id: tId,
        type: 'inventory_buy',
        date: getTodayDateStr(),
        desc: 'Belanja Stok Kekurangan Pesanan',
        amount: totalSpent,
        createdAt: Date.now()
      });
    }

    await batch.commit();
    showToast(`Semua belanja dibeli! Persediaan +${formatRp(totalSpent)}`);
  };

  const copyShoppingListWA = () => {
    if (metrics.shoppingList.length === 0) return showToast('Tidak ada daftar belanja yang kurang.');
    const lines = [
      '*DAFTAR BELANJA BUAH SUPPLIER*',
      ...metrics.shoppingList.map((it, i) => `${i + 1}. ${it.fruitName}: *${it.deficit} ${it.unit}* (Est. ${formatRp(it.estCost)})`),
      `*Total Estimasi:* ${formatRp(metrics.totalShoppingCost)}`
    ];
    copyTextSafe(lines.join('\n'), 'Daftar belanja disalin untuk WhatsApp!');
  };

  const openFruitModal = (fruit) => {
    if (fruit) {
      setFruitForm({ ...fruit });
    } else {
      setFruitForm({ id: '', name: '', unit: 'kg', stock: 0, buyPrice: '', sellPrice: '', minStock: 1 });
    }
    setFruitModalOpen(true);
  };

  const saveFruitForm = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = fruitForm.id || 'f_' + Date.now();
    await setDoc(userDoc('fruits', id), {
      id,
      name: fruitForm.name.trim(),
      unit: fruitForm.unit.trim(),
      stock: Number(fruitForm.stock) || 0,
      buyPrice: Number(fruitForm.buyPrice) || 0,
      sellPrice: Number(fruitForm.sellPrice) || 0,
      minStock: Number(fruitForm.minStock) || 1
    });
    setFruitModalOpen(false);
    showToast(fruitForm.id ? 'Data buah diperbarui!' : 'Buah baru ditambahkan!');
  };

  const deleteFruit = async (fruitId) => {
    if (!user) return;
    await deleteDoc(userDoc('fruits', fruitId));
    showToast('Item buah dihapus.');
  };

  // Belanja Multi-Item & Auto-Create Buah Baru
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
    setBulkModalOpen(true);
  };

  const saveBulkRestockForm = async (e) => {
    e.preventDefault();
    if (!user || bulkRows.length === 0) return;
    const batch = writeBatch(db);
    let grandTotal = 0;
    let newFruitsCreated = 0;
    const summaryNames = [];

    bulkRows.forEach((r, idx) => {
      const qty = Number(r.qty) || 0;
      const buyPrice = Number(r.buyPrice) || 0;
      if (qty <= 0) return;
      grandTotal += qty * buyPrice;

      if (r.fruitId === 'NEW') {
        const cleanName = (r.customName || '').trim();
        const cleanUnit = (r.unit || 'kg').trim();
        if (!cleanName) return;

        const existing = fruits.find((f) => f.name.trim().toLowerCase() === cleanName.toLowerCase());
        const sellPrice =
          r.sellPrice !== '' && Number(r.sellPrice) > 0 ? Number(r.sellPrice) : Math.round(buyPrice * 1.25);

        if (existing) {
          batch.update(userDoc('fruits', existing.id), {
            stock: Number((Number(existing.stock) + qty).toFixed(2)),
            ...(buyPrice > 0 ? { buyPrice } : {}),
            ...(r.sellPrice !== '' && Number(r.sellPrice) > 0 ? { sellPrice: Number(r.sellPrice) } : {})
          });
          summaryNames.push(`${existing.name} (${qty} ${existing.unit})`);
        } else {
          const newId = 'f_' + Date.now() + '_' + idx;
          batch.set(userDoc('fruits', newId), {
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
        }
      } else {
        const found = fruits.find((f) => f.id === r.fruitId);
        if (found) {
          batch.update(userDoc('fruits', found.id), {
            stock: Number((Number(found.stock) + qty).toFixed(2)),
            ...(buyPrice > 0 ? { buyPrice } : {}),
            ...(r.sellPrice !== '' && Number(r.sellPrice) > 0 ? { sellPrice: Number(r.sellPrice) } : {})
          });
          summaryNames.push(`${found.name} (${qty} ${found.unit})`);
        }
      }
    });

    if (grandTotal > 0) {
      const tId = 't_' + Date.now();
      batch.set(userDoc('transactions', tId), {
        id: tId,
        type: 'inventory_buy',
        date: bulkDate || getTodayDateStr(),
        desc: `Belanja Stok${bulkNote ? ' (' + bulkNote + ')' : ''}: ${summaryNames.join(', ')}`,
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
  // 7. ORDER, KALKULATOR BUNDLING & PENYELESAIAN
  // ==========================================================================
  const openOrderSheet = (mode) => {
    const first = fruits[0];
    setOrderMode(mode);
    setBundleItems(
      first
        ? [
            {
              fruitId: first.id,
              fruitName: first.name,
              qty: mode === 'single' ? 1 : 0.5,
              unit: first.unit,
              buyPrice: first.buyPrice,
              sellPrice: first.sellPrice
            }
          ]
        : []
    );
    setOrderCustomer('');
    setOrderStatus('confirmed');
    setOrderMult(1);
    setOrderCustomSell('');
    setOrderNotes('');
    setOrderSheetOpen(true);
  };

  const orderCalc = useMemo(() => {
    const mult = Number(orderMult) || 1;
    const baseCost = bundleItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.buyPrice || 0), 0);
    const baseSell = bundleItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.sellPrice || 0), 0);
    const totalCost = baseCost * mult;
    const finalSell = orderCustomSell !== '' ? Number(orderCustomSell) : baseSell * mult;
    return { mult, totalCost, finalSell, profit: finalSell - totalCost };
  }, [bundleItems, orderMult, orderCustomSell]);

  const saveOrderSheet = async (e) => {
    e.preventDefault();
    if (!user || bundleItems.length === 0) return;
    const items = bundleItems.map((it) => ({
      ...it,
      qty: Number((Number(it.qty) * orderCalc.mult).toFixed(2))
    }));
    const id = 'o_' + Date.now();
    await setDoc(userDoc('orders', id), {
      id,
      customer: orderCustomer.trim(),
      status: orderStatus,
      paymentStatus: 'unpaid',
      notes: orderNotes.trim() || items.map((i) => `${i.fruitName} ${i.qty}${i.unit}`).join(', '),
      items,
      totalCost: orderCalc.totalCost,
      totalSell: orderCalc.finalSell,
      createdAt: Date.now()
    });
    setOrderSheetOpen(false);
    showToast('Order baru berhasil dicatat!');
  };

  const copyOrderPaymentWA = (o) => {
    const itemsText =
      o.items && o.items.length > 0
        ? o.items.map((it, idx) => `${idx + 1}. ${it.fruitName} (${it.qty} ${it.unit})`).join('\n')
        : o.notes || '-';
    const banksText =
      bankAccounts.length > 0
        ? bankAccounts.map((b) => `• *${b.bank}*: ${b.number} (a.n. ${b.holder})`).join('\n')
        : '• (Belum ada rekening tersimpan)';

    const msg = [
      `Halo Kak *${o.customer}*, berikut rincian pesanan buahnya ya:`,
      '',
      itemsText,
      o.notes ? `_Catatan: ${o.notes}_` : '',
      '',
      `*Total Pembayaran: ${formatRp(o.totalSell)}*`,
      '',
      'Pembayaran bisa ditransfer ke rekening berikut:',
      banksText,
      '',
      'Terima kasih!'
    ]
      .filter((line) => line !== '')
      .join('\n');

    copyTextSafe(msg, 'Rincian pesanan & info bank disalin untuk WA!');
  };

  const confirmCompleteOrder = async (payStatus) => {
    if (!user || !completeOrderTarget) return;
    const o = completeOrderTarget;
    const batch = writeBatch(db);

    (o.items || []).forEach((it) => {
      const f = fruits.find((item) => item.name.trim().toLowerCase() === it.fruitName.trim().toLowerCase());
      if (f) {
        batch.update(userDoc('fruits', f.id), {
          stock: Math.max(0, Number((Number(f.stock) - Number(it.qty)).toFixed(2)))
        });
      }
    });

    batch.update(userDoc('orders', o.id), {
      status: 'completed',
      paymentStatus: payStatus,
      completedDate: completeDate
    });

    const saleId = 'sale_' + o.id;
    batch.set(userDoc('transactions', saleId), {
      id: saleId,
      orderId: o.id,
      type: 'sale',
      paymentStatus: payStatus,
      date: completeDate,
      customer: o.customer,
      notes: o.notes,
      items: o.items || [],
      desc: `Penjualan: ${o.customer} (${o.notes})`,
      amount: Number(o.totalSell),
      costAmount: Number(o.totalCost),
      createdAt: Date.now()
    });

    await batch.commit();
    setCompleteOrderTarget(null);
    showToast(payStatus === 'paid' ? 'Order lunas & stok terpotong!' : 'Order selesai & masuk ke Tab Piutang!');
  };

  const deleteOrder = async (orderId) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.delete(userDoc('orders', orderId));
    const linked = transactions.filter((t) => t.orderId === orderId);
    linked.forEach((t) => batch.delete(userDoc('transactions', t.id)));
    await batch.commit();
    showToast('Order & catatan terkait dihapus.');
  };

  // ==========================================================================
  // 8. PIUTANG, REKENING & KEUANGAN
  // ==========================================================================
  const markReceivablePaid = async (o) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.update(userDoc('orders', o.id), { paymentStatus: 'paid' });
    const trx = transactions.find((t) => t.orderId === o.id && t.type === 'sale');
    if (trx) {
      batch.update(userDoc('transactions', trx.id), {
        paymentStatus: 'paid',
        date: getTodayDateStr()
      });
    }
    await batch.commit();
    showToast(`Piutang ${o.customer} ditandai Lunas!`);
  };

  const saveBankForm = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = 'b_' + Date.now();
    await setDoc(userDoc('bankAccounts', id), {
      id,
      bank: bankForm.bank.trim(),
      number: bankForm.number.trim(),
      holder: bankForm.holder.trim()
    });
    setBankForm({ bank: '', number: '', holder: '' });
    setBankModalOpen(false);
    showToast('Rekening pembayaran ditambahkan!');
  };

  const saveFinanceForm = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = 't_' + Date.now();
    await setDoc(userDoc('transactions', id), {
      id,
      type: financeForm.type,
      date: financeForm.date || getTodayDateStr(),
      desc: financeForm.desc.trim(),
      amount: Number(financeForm.amount) || 0,
      createdAt: Date.now()
    });
    setFinanceModalOpen(false);
    showToast('Transaksi keuangan dicatat!');
  };

  // ==========================================================================
  // 9. DATA KEUANGAN PER PERIODE
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
        map[key].totalQty = Number((map[key].totalQty + Number(it.qty || 0)).toFixed(2));
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
    const net = gross - opex;
    const margin = rev > 0 ? Math.round((net / rev) * 100) : 0;
    return { rev, hpp, gross, opex, net, margin };
  }, [transactions, financePeriods.pnl]);

  const balanceData = useMemo(() => {
    const list = transactions.filter((t) => isDateInPeriod(t.date, financePeriods.balance));
    const capIn = list.filter((t) => t.type === 'capital').reduce((s, t) => s + Number(t.amount || 0), 0);
    const paidCash = list.filter((t) => t.type === 'sale' && t.paymentStatus === 'paid').reduce((s, t) => s + Number(t.amount || 0), 0);
    const unpaidAr = list.filter((t) => t.type === 'sale' && t.paymentStatus === 'unpaid').reduce((s, t) => s + Number(t.amount || 0), 0);
    const invBought = list.filter((t) => t.type === 'inventory_buy').reduce((s, t) => s + Number(t.amount || 0), 0);
    const opexPaid = list.filter((t) => t.type === 'opex').reduce((s, t) => s + Number(t.amount || 0), 0);
    const rev = list.filter((t) => t.type === 'sale').reduce((s, t) => s + Number(t.amount || 0), 0);
    const hpp = list.filter((t) => t.type === 'sale').reduce((s, t) => s + Number(t.costAmount || 0), 0);
    const net = rev - hpp - opexPaid;
    const cash = capIn + paidCash - invBought - opexPaid;
    return {
      cash,
      unpaidAr,
      inv: metrics.inventoryValue,
      totalAssets: cash + unpaidAr + metrics.inventoryValue,
      capIn,
      net,
      totalEquity: capIn + net
    };
  }, [transactions, financePeriods.balance, metrics.inventoryValue]);

  const cashflowData = useMemo(() => {
    const list = transactions.filter((t) => isDateInPeriod(t.date, financePeriods.cashflow));
    let cfIn = 0;
    let cfOut = 0;
    const items = [];
    list.forEach((t) => {
      if (t.type === 'capital' || (t.type === 'sale' && t.paymentStatus === 'paid')) {
        cfIn += Number(t.amount || 0);
        items.push({ ...t, dir: 'in' });
      } else if (t.type === 'inventory_buy' || t.type === 'opex') {
        cfOut += Number(t.amount || 0);
        items.push({ ...t, dir: 'out' });
      }
    });
    return { cfIn, cfOut, items };
  }, [transactions, financePeriods.cashflow]);

  const activeThemeVars = THEME_STYLES[theme] || THEME_STYLES.fresh;

  return (
    <div style={{ backgroundColor: activeThemeVars['--bg-outer'], minHeight: '100vh' }} className="flex justify-center font-sans">
      <div
        style={{
          ...activeThemeVars,
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-main)'
        }}
        className="w-full max-w-[440px] min-h-screen relative flex flex-col shadow-2xl overflow-x-hidden"
      >
        {/* TOAST */}
        {toastMsg && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[390px]">
            <div className="px-4 py-3 rounded-2xl shadow-xl text-white text-xs font-semibold bg-emerald-600">
              {toastMsg}
            </div>
          </div>
        )}

        {/* HEADER & THEME SWITCHER */}
        <header style={{ background: 'var(--header-grad)' }} className="px-4 pt-4 pb-5 text-white rounded-b-[1.75rem] shadow-md sticky top-0 z-30">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-extrabold text-sm">
                BS
              </div>
              <div>
                <h1 className="font-extrabold text-base leading-tight">BuahSegar Mobile</h1>
                <p className="text-[11px] text-white/80 font-medium">
                  {dbError ? 'Error Firebase' : user ? 'Cloud Firestore Aktif' : 'Menghubungkan...'}
                </p>
              </div>
            </div>
            <button
              onClick={seedDemoToFirestore}
              className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-[11px] font-semibold"
            >
              Muat Data Awal
            </button>
          </div>

          <div className="bg-black/20 p-1 rounded-xl flex items-center justify-between gap-1 text-[11px] font-semibold">
            {[
              { id: 'fresh', label: '1. Fresh' },
              { id: 'bento', label: '2. Bento POS' },
              { id: 'pastel', label: '3. Pastel' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  theme === t.id ? 'bg-white text-slate-900 font-extrabold shadow' : 'text-white/80'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 px-4 pt-4 pb-28 space-y-4">
          {dbError && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500 text-rose-600 text-xs font-semibold">
              {dbError}
            </div>
          )}

          {/* EMPTY PROMPT JIKA BELUM ADA DATA DI FIRESTORE */}
          {!loadingDb && fruits.length === 0 && orders.length === 0 && (
            <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-4 text-center space-y-2.5">
              <p className="text-xs font-bold">Database Firestore masih kosong.</p>
              <button
                onClick={seedDemoToFirestore}
                style={{ backgroundColor: 'var(--accent)' }}
                className="px-4 py-2 rounded-xl text-white text-xs font-extrabold"
              >
                + Isi Stok & Order Awal Sekarang
              </button>
            </div>
          )}

          {/* ================= VIEW 1: BERANDA ================= */}
          {currentView === 'home' && (
            <section className="space-y-4">
              <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 flex items-center justify-between gap-2">
                <div>
                  <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold uppercase block">Input Cepat Pelanggan</span>
                  <p className="text-xs font-extrabold">Catat Order Satuan / Paket</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openOrderSheet('single')}
                    style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                    className="px-3 py-2 rounded-xl text-[11px] font-bold"
                  >
                    + Satuan
                  </button>
                  <button
                    onClick={() => openOrderSheet('bundle')}
                    style={{ backgroundColor: 'var(--accent)' }}
                    className="px-3 py-2 rounded-xl text-white text-[11px] font-bold"
                  >
                    + Bundling
                  </button>
                </div>
              </div>

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
                            Kurang: <b className="text-amber-600">{item.deficit} {item.unit}</b> • Est. {formatRp(item.estCost)}
                          </span>
                        </div>
                        <button
                          onClick={() => item.fruitId && adjustStock(item.fruitId, Math.ceil(item.deficit * 2) / 2, true)}
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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600">
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

          {/* ================= VIEW 2: STOK BUAH ================= */}
          {currentView === 'stock' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Stok Buah di Rumah</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Kelola persediaan & harga beli modal</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={openBulkRestockModal}
                    style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold"
                  >
                    + Belanja Stok
                  </button>
                  <button
                    onClick={() => openFruitModal(null)}
                    style={{ backgroundColor: 'var(--accent)' }}
                    className="px-3 py-2 rounded-xl text-white text-xs font-bold"
                  >
                    + Buah
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'low', label: 'Habis / Menipis' },
                  { id: 'ready', label: 'Stok Aman' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStockFilter(f.id)}
                    style={
                      stockFilter === f.id
                        ? { backgroundColor: 'var(--accent)', color: '#fff' }
                        : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                    }
                    className="px-3 py-1.5 rounded-xl border"
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {fruits
                  .filter((f) =>
                    stockFilter === 'low'
                      ? Number(f.stock) <= Number(f.minStock)
                      : stockFilter === 'ready'
                      ? Number(f.stock) > Number(f.minStock)
                      : true
                  )
                  .map((f) => {
                    const empty = Number(f.stock) <= 0;
                    const low = Number(f.stock) <= Number(f.minStock);
                    return (
                      <div key={f.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <strong className="text-sm font-extrabold">{f.name}</strong>
                              {empty ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold">HABIS</span>
                              ) : low ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold">MENIPIS</span>
                              ) : null}
                            </div>
                            <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                              Modal: <b>{formatRp(f.buyPrice)}</b>/{f.unit} • Jual: <b className="text-emerald-600">{formatRp(f.sellPrice)}</b>
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openFruitModal(f)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="px-2 py-1 rounded-lg text-[11px] font-bold">
                              Edit
                            </button>
                            <button onClick={() => deleteFruit(f.id)} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 text-[11px] font-bold">
                              Hapus
                            </button>
                          </div>
                        </div>
                        <div style={{ borderColor: 'var(--border-color)' }} className="flex items-center justify-between pt-2 border-t">
                          <span className={`text-xs font-extrabold ${empty ? 'text-rose-500' : ''}`}>
                            Stok: {f.stock} {f.unit}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => adjustStock(f.id, -0.5, false)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-8 h-8 rounded-xl font-extrabold text-sm">
                              -0.5
                            </button>
                            <button onClick={() => adjustStock(f.id, 1, true)} style={{ backgroundColor: 'var(--accent)' }} className="px-3 h-8 rounded-xl text-white text-xs font-bold">
                              +1 Beli
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* ================= VIEW 3: ORDER & BUNDLING ================= */}
          {currentView === 'orders' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">Order & Request Pelanggan</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Racik bundling & selesaikan pesanan</p>
                </div>
                <button
                  onClick={() => openOrderSheet('bundle')}
                  style={{ backgroundColor: 'var(--accent)' }}
                  className="px-3 py-2 rounded-xl text-white text-xs font-bold"
                >
                  + Kalkulator
                </button>
              </div>

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
                                  ? 'bg-slate-500/15 text-slate-600'
                                  : isReq
                                  ? 'bg-amber-500/15 text-amber-600'
                                  : 'bg-emerald-500/15 text-emerald-600'
                              }`}
                            >
                              {isDone ? 'Selesai' : isReq ? 'Request Paket' : 'Pesanan Pasti'}
                            </span>
                            {isDone && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white ${o.paymentStatus === 'paid' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                                {o.paymentStatus === 'paid' ? 'LUNAS' : 'PIUTANG'}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-extrabold mt-1">{o.customer}</h3>
                          <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">{o.notes}</p>
                        </div>
                        <button onClick={() => deleteOrder(o.id)} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 text-[11px] font-bold">
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
                          <strong>{formatRp(o.totalCost)} / <span className="text-emerald-600">{formatRp(o.totalSell)}</span></strong>
                        </div>
                        <div className="text-right">
                          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] block">Est. Laba</span>
                          <strong className="text-teal-600">+{formatRp(profit)}</strong>
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
                                onClick={() => updateDoc(userDoc('orders', o.id), { status: 'confirmed' })}
                                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-extrabold"
                              >
                                Deal Request
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setCompleteOrderTarget(o);
                                setCompleteDate(getTodayDateStr());
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
                        <button onClick={() => deleteDoc(userDoc('bankAccounts', b.id))} className="px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 text-[11px] font-bold">
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const unpaidList = orders.filter((o) => o.status === 'completed' && o.paymentStatus === 'unpaid');
                const totalAr = unpaidList.reduce((s, o) => s + Number(o.totalSell || 0), 0);
                return (
                  <>
                    <div className="rounded-2xl p-3.5 flex items-center justify-between bg-amber-500/10 border border-amber-500/30">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-600 block">Total Piutang Belum Lunas</span>
                        <strong className="text-base font-extrabold text-amber-600">{formatRp(totalAr)}</strong>
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
                              <strong className="text-sm font-extrabold text-amber-600">{formatRp(o.totalSell)}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyOrderPaymentWA(o)}
                                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                                className="flex-1 py-2 rounded-xl font-bold"
                              >
                                Tagih via WA
                              </button>
                              <button
                                onClick={() => markReceivablePaid(o)}
                                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                              >
                                Tandai Lunas
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
                  <h2 className="text-base font-extrabold">Laporan Keuangan</h2>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">Penjualan, Laba Rugi, Neraca & Kas</p>
                </div>
                <button
                  onClick={() => {
                    setFinanceForm({ type: 'opex', date: getTodayDateStr(), desc: '', amount: '' });
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

              {/* Filter Periode untuk Sub-Tab Aktif */}
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
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'}`}>
                                    #{idx + 1}
                                  </span>
                                  <div className="truncate">
                                    <strong className="font-extrabold block truncate">{tf.fruitName}</strong>
                                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                                      {tf.trxCount}x order • Modal {formatRp(tf.totalModal)}
                                    </span>
                                  </div>
                                </div>
                                <strong className="text-xs font-extrabold text-emerald-600 shrink-0">
                                  {tf.totalQty} {tf.unit}
                                </strong>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
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
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${t.paymentStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
                                  {t.paymentStatus === 'paid' ? 'LUNAS' : 'PIUTANG'}
                                </span>
                              </div>
                              <span style={{ color: 'var(--text-muted)' }} className="text-[11px] block mt-0.5">Tgl: {t.date}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <strong className="text-sm font-extrabold text-emerald-600 block">{formatRp(t.amount)}</strong>
                              <button onClick={() => deleteDoc(userDoc('transactions', t.id))} className="text-[10px] text-rose-500 font-bold">
                                Hapus
                              </button>
                            </div>
                          </div>

                          <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-2.5 rounded-xl space-y-1">
                            {itemList.map((it, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold">• {it.fruitName} <b className="text-emerald-600">({it.qty} {it.unit})</b></span>
                                <span style={{ color: 'var(--text-muted)' }}>Modal {formatRp(Number(it.qty) * Number(it.buyPrice || 0))}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ borderColor: 'var(--border-color)' }} className="flex items-center justify-between text-[11px] pt-1 border-t">
                            <span style={{ color: 'var(--text-muted)' }}>Total HPP: <b>{formatRp(t.costAmount)}</b></span>
                            <span className="text-teal-600 font-extrabold">Laba Kotor: +{formatRp(gp)}</span>
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
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: NERACA */}
              {financeSubTab === 'balance' && (
                <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">Posisi Neraca Usaha</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600">SEIMBANG</span>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl space-y-1.5">
                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-extrabold uppercase block">AKTIVA (HARTA USAHA)</span>
                    <div className="flex justify-between"><span>Kas & Saldo Rekening</span><strong>{formatRp(balanceData.cash)}</strong></div>
                    <div className="flex justify-between"><span>Piutang Usaha</span><strong>{formatRp(balanceData.unpaidAr)}</strong></div>
                    <div className="flex justify-between"><span>Persediaan Stok Buah</span><strong>{formatRp(balanceData.inv)}</strong></div>
                    <div style={{ borderColor: 'var(--border-color)' }} className="flex justify-between pt-1.5 border-t font-extrabold">
                      <span>Total Aktiva</span><strong className="text-emerald-600">{formatRp(balanceData.totalAssets)}</strong>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl space-y-1.5">
                    <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-extrabold uppercase block">PASIVA (MODAL & LABA)</span>
                    <div className="flex justify-between"><span>Modal Disetor Awal</span><strong>{formatRp(balanceData.capIn)}</strong></div>
                    <div className="flex justify-between"><span>Laba Bersih Akumulasi</span><strong>{formatRp(balanceData.net)}</strong></div>
                    <div style={{ borderColor: 'var(--border-color)' }} className="flex justify-between pt-1.5 border-t font-extrabold">
                      <span>Total Pasiva</span><strong className="text-emerald-600">{formatRp(balanceData.totalEquity)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: ARUS KAS */}
              {financeSubTab === 'cashflow' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Kas Masuk</span>
                      <strong className="text-sm font-extrabold text-emerald-500">{formatRp(cashflowData.cfIn)}</strong>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3">
                      <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-bold block">Kas Keluar</span>
                      <strong className="text-sm font-extrabold text-rose-500">{formatRp(cashflowData.cfOut)}</strong>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {cashflowData.items.map((t) => (
                      <div key={t.id} style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <strong className="block">{t.desc}</strong>
                          <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">{t.date}</span>
                        </div>
                        <strong className={t.dir === 'in' ? 'text-emerald-600' : 'text-rose-500'}>
                          {t.dir === 'in' ? '+' : '-'}{formatRp(t.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
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

        {/* BOTTOM NAVIGATION */}
        <nav
          style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border-color)' }}
          className="fixed bottom-0 w-full max-w-[440px] border-t backdrop-blur-md z-30 grid grid-cols-5 py-2 px-1 text-[10px] font-bold"
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
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl font-extrabold"
            >
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* ================= MODAL 1: TAMBAH / EDIT BUAH ================= */}
        {fruitModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">{fruitForm.id ? 'Edit Stok Buah' : 'Tambah Buah Baru'}</h3>
                <button onClick={() => setFruitModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <form onSubmit={saveFruitForm} className="space-y-3 text-xs">
                <input required placeholder="Nama Buah" value={fruitForm.name} onChange={(e) => setFruitForm({ ...fruitForm, name: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="Satuan (kg / 500gr)" value={fruitForm.unit} onChange={(e) => setFruitForm({ ...fruitForm, unit: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                  <input required type="number" step="0.1" placeholder="Stok" value={fruitForm.stock} onChange={(e) => setFruitForm({ ...fruitForm, stock: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input required type="number" placeholder="Harga Modal (Rp)" value={fruitForm.buyPrice} onChange={(e) => setFruitForm({ ...fruitForm, buyPrice: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                  <input required type="number" placeholder="Harga Jual (Rp)" value={fruitForm.sellPrice} onChange={(e) => setFruitForm({ ...fruitForm, sellPrice: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                </div>
                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Data Buah
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
                  <input placeholder="Supplier / Catatan" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2 rounded-xl outline-none" />
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold">Daftar Buah Dibeli</span>
                  <button
                    type="button"
                    onClick={() => setBulkRows([...bulkRows, { fruitId: 'NEW', customName: '', unit: 'kg', qty: 1, buyPrice: '', sellPrice: '' }])}
                    className="text-emerald-600 font-extrabold"
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
                          <option key={f.id} value={f.id}>{f.name} (Stok: {f.stock})</option>
                        ))}
                      </select>
                      {bulkRows.length > 1 && (
                        <button type="button" onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))} className="px-2 rounded-lg bg-rose-500/15 text-rose-600 font-bold">
                          x
                        </button>
                      )}
                    </div>

                    {r.fruitId === 'NEW' && (
                      <div className="grid grid-cols-3 gap-1.5">
                        <input required placeholder="Nama buah baru" value={r.customName} onChange={(e) => { const c = [...bulkRows]; c[idx].customName = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="col-span-2 px-2.5 py-2 rounded-xl outline-none" />
                        <input required placeholder="Satuan" value={r.unit} onChange={(e) => { const c = [...bulkRows]; c[idx].unit = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-2 rounded-xl outline-none" />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      <input type="number" step="0.1" required placeholder="Qty" value={r.qty} onChange={(e) => { const c = [...bulkRows]; c[idx].qty = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-1.5 rounded-xl font-bold outline-none" />
                      <input type="number" required placeholder="Harga Beli" value={r.buyPrice} onChange={(e) => { const c = [...bulkRows]; c[idx].buyPrice = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-1.5 rounded-xl font-bold outline-none" />
                      <input type="number" placeholder="Harga Jual" value={r.sellPrice} onChange={(e) => { const c = [...bulkRows]; c[idx].sellPrice = e.target.value; setBulkRows(c); }} style={{ backgroundColor: 'var(--bg-card)' }} className="px-2.5 py-1.5 rounded-xl font-bold outline-none" />
                    </div>
                  </div>
                ))}

                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Belanja & Update Stok
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 3: ORDER / KALKULATOR BUNDLING ================= */}
        {orderSheetOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Buat Order / Paket Bundling</h3>
                <button onClick={() => setOrderSheetOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="grid grid-cols-2 gap-1.5 p-1 rounded-xl text-xs font-bold">
                <button type="button" onClick={() => { setOrderMode('single'); setBundleItems(bundleItems.slice(0, 1)); }} style={orderMode === 'single' ? { backgroundColor: 'var(--accent)', color: '#fff' } : {}} className="py-2 rounded-lg">
                  Order Satuan
                </button>
                <button type="button" onClick={() => setOrderMode('bundle')} style={orderMode === 'bundle' ? { backgroundColor: 'var(--accent)', color: '#fff' } : {}} className="py-2 rounded-lg">
                  Kalkulator Bundling
                </button>
              </div>

              <form onSubmit={saveOrderSheet} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="Nama Pelanggan" value={orderCustomer} onChange={(e) => setOrderCustomer(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                  <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none">
                    <option value="confirmed">Pesanan Pasti (Deal)</option>
                    <option value="request">Masih Request</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-bold">Daftar Buah</span>
                    {orderMode === 'bundle' && (
                      <button
                        type="button"
                        onClick={() => {
                          const f = fruits[0];
                          if (f) setBundleItems([...bundleItems, { fruitId: f.id, fruitName: f.name, qty: 0.5, unit: f.unit, buyPrice: f.buyPrice, sellPrice: f.sellPrice }]);
                        }}
                        className="text-emerald-600 font-extrabold"
                      >
                        + Tambah Buah
                      </button>
                    )}
                  </div>
                  {bundleItems.map((it, idx) => (
                    <div key={idx} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="flex items-center gap-1.5 p-2 rounded-xl">
                      <select
                        value={it.fruitId}
                        onChange={(e) => {
                          const f = fruits.find((item) => item.id === e.target.value);
                          if (!f) return;
                          const copy = [...bundleItems];
                          copy[idx] = { fruitId: f.id, fruitName: f.name, qty: copy[idx].qty, unit: f.unit, buyPrice: f.buyPrice, sellPrice: f.sellPrice };
                          setBundleItems(copy);
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
                        step="0.1"
                        min="0.1"
                        value={it.qty}
                        onChange={(e) => {
                          const copy = [...bundleItems];
                          copy[idx].qty = Number(e.target.value) || 0;
                          setBundleItems(copy);
                        }}
                        style={{ backgroundColor: 'var(--bg-card)' }}
                        className="w-16 px-2 py-1.5 rounded-lg text-center font-bold outline-none"
                      />
                      <span className="text-[11px] w-10 truncate">{it.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="1" placeholder="Jumlah Paket" value={orderMult} onChange={(e) => setOrderMult(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                  <input type="number" placeholder="Harga Jual Final (Otomatis)" value={orderCustomSell} onChange={(e) => setOrderCustomSell(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                </div>

                <div style={{ backgroundColor: 'var(--bg-card-sub)' }} className="p-3 rounded-xl flex justify-between">
                  <div><span className="text-[10px] block">Modal</span><strong>{formatRp(orderCalc.totalCost)}</strong></div>
                  <div><span className="text-[10px] block">Harga Jual</span><strong className="text-emerald-600">{formatRp(orderCalc.finalSell)}</strong></div>
                  <div><span className="text-[10px] block">Est. Laba</span><strong className="text-teal-600">{formatRp(orderCalc.profit)}</strong></div>
                </div>

                <input placeholder="Catatan Paket (Opsional)" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />

                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Order
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 4: SELESAIKAN ORDER ================= */}
        {completeOrderTarget && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Selesaikan Order</h3>
                <button onClick={() => setCompleteOrderTarget(null)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <p className="text-xs">{completeOrderTarget.customer} • Total Tagihan {formatRp(completeOrderTarget.totalSell)}</p>
              <div className="text-xs space-y-1">
                <label className="font-bold block">Tanggal Selesai / Pembayaran</label>
                <input type="date" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl font-semibold outline-none" />
              </div>
              <div className="space-y-2 pt-1">
                <button onClick={() => confirmCompleteOrder('paid')} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
                  Lunas (Sudah Bayar Tunai / Transfer)
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

        {/* ================= MODAL 6: CATAT TRANSAKSI KEUANGAN ================= */}
        {financeModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div style={{ backgroundColor: 'var(--bg-card)' }} className="w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Catat Transaksi Keuangan</h3>
                <button onClick={() => setFinanceModalOpen(false)} style={{ color: 'var(--text-muted)' }} className="text-xs font-bold">Tutup</button>
              </div>
              <form onSubmit={saveFinanceForm} className="space-y-3 text-xs">
                <select value={financeForm.type} onChange={(e) => setFinanceForm({ ...financeForm, type: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none">
                  <option value="opex">Biaya Operasional (Plastik, Mika, Pita, Ongkir)</option>
                  <option value="capital">Setoran Modal Tambahan</option>
                  <option value="inventory_buy">Belanja Stok Buah (Masuk Persediaan)</option>
                </select>
                <input type="date" required value={financeForm.date} onChange={(e) => setFinanceForm({ ...financeForm, date: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <input required placeholder="Keterangan" value={financeForm.desc} onChange={(e) => setFinanceForm({ ...financeForm, desc: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <input type="number" required placeholder="Nominal (Rp)" value={financeForm.amount} onChange={(e) => setFinanceForm({ ...financeForm, amount: e.target.value })} style={{ backgroundColor: 'var(--bg-card-sub)' }} className="w-full px-3 py-2.5 rounded-xl outline-none" />
                <button type="submit" style={{ backgroundColor: 'var(--accent)' }} className="w-full py-3 rounded-xl text-white font-extrabold">
                  Simpan Transaksi
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
