# BuahSegar Mobile — POS, Inventory & Akuntansi Bisnis Buah

## Langkah Cepat Menjalankan & Deploy
1. Masuk ke folder project:
   ```bash
   cd buahsegar-app
   npm install
   ```
2. Salin `.env.example` menjadi `.env.local` dan isi kunci dari **Firebase Console**.
3. Upload aturan keamanan dari file `firestore.rules` ke **Firebase Console > Firestore > Rules**.
4. Jalankan lokal:
   ```bash
   npm run dev
   ```
5. Push ke **GitHub**, lalu import repository ke **Vercel** (tambahkan Environment Variables yang sama di pengaturan Vercel).
