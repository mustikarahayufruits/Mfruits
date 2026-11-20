import React, { useEffect, useState } from 'react';
import {
  initDatabaseAuth,
  seedInitialDatabase,
  BuahSegarDB
} from './database/firestore-database-setup';

export default function App() {
  const [user, setUser] = useState(null);
  const [fruits, setFruits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('Menghubungkan ke Firebase...');

  useEffect(() => {
    let unsub = () => {};
    initDatabaseAuth()
      .then((u) => {
        setUser(u);
        setStatus('Terhubung ke Firestore Real-time');
        unsub = BuahSegarDB.subscribeAll(u.uid, {
          fruits: setFruits,
          orders: setOrders
        });
      })
      .catch((err) => {
        setStatus('Menunggu konfigurasi .env Firebase: ' + err.message);
      });
    return () => unsub();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 440, margin: '0 auto', padding: 20 }}>
      <h2>BuahSegar Mobile (Firebase Ready)</h2>
      <p style={{ fontSize: 13, color: '#059669' }}>{status}</p>
      {user && fruits.length === 0 && (
        <button
          onClick={() => seedInitialDatabase(user.uid)}
          style={{
            padding: '10px 16px',
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          + Isi Data Stok Awal ke Firestore
        </button>
      )}
      <div style={{ marginTop: 20 }}>
        <h4>Stok Buah Tersimpan ({fruits.length})</h4>
        <ul>
          {fruits.map((f) => (
            <li key={f.id}>
              {f.name} — {f.stock} {f.unit} (Modal Rp {Number(f.buyPrice).toLocaleString('id-ID')})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
