# Panduan Lengkap - Bahasa Indonesia

## 🚀 Cara Menjalankan Aplikasi

### Pertama Kali (Setup)

```bash
# Jalankan script setup otomatis
./setup.sh

# Atau manual:
yarn install
npm rebuild better-sqlite3
cp .env.example .env
```

### Menjalankan Aplikasi

```bash
yarn app:dev
```

**Selesai!** Backend server akan **otomatis start** saat aplikasi Electron dibuka.

## ✨ Fitur Otomatis

Saat menjalankan `yarn app:dev`:

1. ✅ **Backend server otomatis start** di port 3000
   - Cek apakah sudah running (tidak duplikat)
   - Tunggu sampai siap
   - Otomatis stop saat aplikasi ditutup

2. ✅ UI dev server start di port 5173

3. ✅ Aplikasi Electron terbuka dengan hot reload

## 📋 Yang Berubah

### Sebelumnya (Ribet)
```bash
# Terminal 1
yarn server

# Terminal 2  
yarn ui:dev

# Terminal 3
yarn app
```

### Sekarang (Mudah)
```bash
yarn app:dev
```

Satu command, semuanya jalan!

## 🔧 Konfigurasi

Edit file `.env`:

```env
DELEGATE=true              # Aktifkan AI review
AI_EXECUTOR=gemini         # Pilih AI: gemini, copilot, kiro, dll
REVIEW_MODE=comment        # comment atau fix
AUTO_MERGE=false           # Auto-merge PR yang approved
API_PORT=3000              # Port backend server
```

## ❓ Troubleshooting

### Error: Native Module

```bash
npm rebuild better-sqlite3
```

### Backend Tidak Start

Cek console Electron untuk error. Atau start manual:

```bash
yarn server
```

### Port Sudah Dipakai

```bash
# Kill process di port 3000
lsof -ti:3000 | xargs kill -9

# Atau ganti port di .env
API_PORT=3001
```

## 📊 Verifikasi

Setelah `yarn app:dev`, cek:

1. **Console Electron** harus muncul:
   ```
   ✓ Backend server started successfully on port 3000
   ```

2. **Dashboard** harus menunjukkan:
   - API Health: **Connected**
   - Live Stream: **Connected**

3. **Tidak ada error** di console

## 🎯 Command Penting

| Command | Fungsi |
|---------|--------|
| `yarn app:dev` | Jalankan semua (recommended) |
| `yarn server` | Backend saja (opsional) |
| `yarn app` | Mode production |
| `yarn once` | Review PR sekali |
| `yarn start` | Review continuous |

## 💡 Tips

- Gunakan `yarn app:dev` untuk development (ada hot reload)
- Backend server otomatis start, tidak perlu manual
- Cek log di folder `logs/` jika ada masalah
- Jalankan `./setup.sh` setelah git pull

## 📚 Dokumentasi Lengkap

- `README.md` - Dokumentasi lengkap (English)
- `QUICK_START.md` - Panduan cepat
- `TROUBLESHOOTING.md` - Solusi masalah umum
- `ARCHITECTURE.md` - Arsitektur sistem
- `RUNNING.md` - Opsi menjalankan aplikasi

## 🎉 Keuntungan Auto-Start

1. **Lebih Mudah**: Satu command untuk semua
2. **Tidak Lupa**: Backend pasti jalan
3. **Auto Cleanup**: Backend stop saat app ditutup
4. **Cek Duplikat**: Tidak start ulang jika sudah running
5. **Error Handling**: Tampilkan error jika gagal start

## 🔍 Cara Kerja

```
yarn app:dev
    ↓
Vite dev server start (port 5173)
    ↓
Electron app launch
    ↓
Cek: Backend sudah running?
    ├─ Ya → Pakai yang ada
    └─ Tidak → Start backend baru
        ↓
    Tunggu backend siap (max 30 detik)
        ↓
    Tampilkan window
        ↓
    Saat app ditutup → Stop backend
```

## 🆘 Butuh Bantuan?

Jika masih ada masalah:

1. Cek log di `logs/review-agent-YYYY-MM-DD.log`
2. Cek console Electron untuk error
3. Cek file `.env` sudah benar
4. Jalankan `./setup.sh` ulang
5. Hapus `data/history.db` dan restart

## 🎊 Selamat!

Aplikasi sekarang lebih mudah digunakan. Cukup `yarn app:dev` dan semuanya jalan otomatis!
