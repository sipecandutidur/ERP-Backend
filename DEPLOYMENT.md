# 🚀 Adinata ERP — Panduan Deployment Ubuntu Server

Panduan lengkap untuk men-deploy aplikasi **Adinata ERP** (Backend Express + Frontend Next.js) di server Ubuntu 22.04 LTS.

---

## 📋 Prasyarat

| Komponen | Versi |
|---|---|
| Ubuntu | 22.04 LTS (direkomendasikan) |
| Node.js | 20.x (LTS) |
| PostgreSQL | 15 atau 16 |
| Nginx | Latest stable |
| PM2 | Latest (process manager) |

---

## 🖥️ Bagian 1: Persiapan Server

### 1.1 Update sistem

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential unzip
```

### 1.2 Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Harus menampilkan v20.x.x
npm -v
```

### 1.3 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup   # Ikuti instruksi yang ditampilkan agar PM2 auto-start
```

---

## 🐘 Bagian 2: Setup PostgreSQL

### 2.1 Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2.2 Buat database dan user

```bash
sudo -u postgres psql
```

Di dalam psql, jalankan perintah berikut:

```sql
-- Buat user baru
CREATE USER erp_user WITH PASSWORD 'GantiPasswordKuat!';

-- Buat database
CREATE DATABASE adinata_erp OWNER erp_user;

-- Beri izin penuh
GRANT ALL PRIVILEGES ON DATABASE adinata_erp TO erp_user;

-- Keluar
\q
```

### 2.3 Test koneksi

```bash
psql -h localhost -U erp_user -d adinata_erp -c "SELECT 1;"
```

---

## 📂 Bagian 3: Deploy Backend (Express + Prisma)

### 3.1 Clone repository

```bash
cd /var/www
sudo mkdir adinata-erp
sudo chown $USER:$USER adinata-erp
cd adinata-erp

git clone https://github.com/sipecandutidur/ERP-Backend.git backend
cd backend
```

### 3.2 Install dependencies

```bash
npm install
```

### 3.3 Konfigurasi environment

```bash
cp .env.example .env
nano .env
```

Isi file `.env` dengan nilai yang sesuai:

```env
PORT=5001
DATABASE_URL="postgresql://erp_user:GantiPasswordKuat!@localhost:5432/adinata_erp"
JWT_SECRET="rahasia-sangat-panjang-dan-acak-123456789"
```

> **⚠️ PENTING**: Ganti `GantiPasswordKuat!` dan `JWT_SECRET` dengan nilai yang benar-benar kuat sebelum deploy production!

### 3.4 Jalankan Prisma Migrations

```bash
# Generate Prisma client
npx prisma generate

# Terapkan semua migrations ke database
npx prisma migrate deploy
```

### 3.5 Restore data dari backup

```bash
# Script ini akan membaca backups/*.json terbaru dan mengisi data master
npx ts-node src/scripts/restore.ts
```

### 3.6 Build TypeScript

```bash
npm run build
```

Output akan tersimpan di folder `dist/`.

### 3.7 Buat folder uploads

```bash
mkdir -p uploads/projects
```

### 3.8 Jalankan dengan PM2

```bash
pm2 start dist/index.js --name "adinata-backend"
pm2 save
```

Cek status:
```bash
pm2 status
pm2 logs adinata-backend
```

---

## 🌐 Bagian 4: Deploy Frontend (Next.js)

### 4.1 Clone repository

```bash
cd /var/www/adinata-erp
git clone https://github.com/sipecandutidur/ERP-Frontend.git frontend
cd frontend
```

### 4.2 Install dependencies

```bash
npm install
```

### 4.3 Konfigurasi environment

```bash
cp .env.example .env.local
nano .env.local
```

Isi:

```env
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP_OR_DOMAIN:5001/api
```

> Ganti `YOUR_SERVER_IP_OR_DOMAIN` dengan IP server atau domain kamu. Contoh:
> - `http://192.168.1.100:5001/api` (IP lokal)
> - `https://erp.adinata.co.id/api` (dengan domain + HTTPS)

### 4.4 Build production

```bash
npm run build
```

Proses ini mungkin memakan waktu 2–5 menit.

### 4.5 Jalankan dengan PM2

```bash
pm2 start npm --name "adinata-frontend" -- start
pm2 save
```

Secara default Next.js akan berjalan di port **3000**.

---

## 🔀 Bagian 5: Setup Nginx (Reverse Proxy)

### 5.1 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 5.2 Konfigurasi Nginx

```bash
sudo nano /etc/nginx/sites-available/adinata-erp
```

Isi dengan konfigurasi berikut:

```nginx
# Frontend (Next.js — port 3000)
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploaded files (static)
    location /uploads/ {
        alias /var/www/adinata-erp/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

> Ganti `YOUR_DOMAIN_OR_IP` dengan domain atau IP server kamu.

### 5.3 Aktifkan konfigurasi

```bash
sudo ln -s /etc/nginx/sites-available/adinata-erp /etc/nginx/sites-enabled/
sudo nginx -t        # Cek konfigurasi (harus "test is successful")
sudo nginx -s reload
```

### 5.4 Sesuaikan NEXT_PUBLIC_API_URL

Setelah Nginx aktif, jika backend berjalan di path `/api`, update `.env.local` frontend:

```env
NEXT_PUBLIC_API_URL=http://YOUR_DOMAIN_OR_IP/api
```

Kemudian build ulang dan restart:

```bash
cd /var/www/adinata-erp/frontend
npm run build
pm2 restart adinata-frontend
```

---

## 🔒 Bagian 6: HTTPS dengan Let's Encrypt (Opsional tapi Direkomendasikan)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Ganti your-domain.com dengan domain kamu yang sudah mengarah ke server ini
sudo certbot --nginx -d your-domain.com

# Cek auto-renewal
sudo certbot renew --dry-run
```

---

## 🔥 Bagian 7: Konfigurasi Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # Port 80 dan 443
sudo ufw enable
sudo ufw status
```

---

## 🔄 Bagian 8: Update Aplikasi (Deployment Ulang)

Ketika ada update kode dari GitHub:

### Update Backend:

```bash
cd /var/www/adinata-erp/backend
git pull origin main
npm install
npx prisma migrate deploy
npm run build
pm2 restart adinata-backend
```

### Update Frontend:

```bash
cd /var/www/adinata-erp/frontend
git pull origin main
npm install
npm run build
pm2 restart adinata-frontend
```

---

## 📊 Bagian 9: Monitoring dan Logs

```bash
# Lihat semua proses PM2
pm2 status

# Logs realtime
pm2 logs adinata-backend
pm2 logs adinata-frontend

# Restart semua
pm2 restart all

# Monitoring CPU & RAM
pm2 monit

# Backup database (jalankan berkala via cron)
cd /var/www/adinata-erp/backend
npx ts-node src/scripts/backup.ts
```

### Setup backup otomatis (Cron Job):

```bash
crontab -e
```

Tambahkan baris berikut untuk backup setiap hari jam 02:00 pagi:

```cron
0 2 * * * cd /var/www/adinata-erp/backend && npx ts-node src/scripts/backup.ts >> /var/log/erp-backup.log 2>&1
```

---

## 🛠️ Troubleshooting

| Masalah | Solusi |
|---|---|
| Backend tidak bisa koneksi ke DB | Cek `DATABASE_URL` di `.env`, pastikan user/password/nama DB benar |
| Frontend menampilkan "Network Error" | Pastikan `NEXT_PUBLIC_API_URL` sesuai dengan URL backend yang bisa diakses |
| PM2 tidak auto-start setelah reboot | Jalankan ulang `pm2 startup` dan `pm2 save` |
| Nginx 502 Bad Gateway | Pastikan PM2 proses sedang berjalan: `pm2 status` |
| `prisma migrate deploy` gagal | Cek koneksi DB dan apakah user punya hak `CREATE TABLE` |
| Upload file tidak bisa diakses | Cek path di konfigurasi Nginx `alias` sesuai dengan lokasi `uploads/` |

---

## 📁 Struktur Folder di Server

```
/var/www/adinata-erp/
├── backend/              ← ERP-Backend (Express + Prisma)
│   ├── .env              ← Environment variables (JANGAN di-commit!)
│   ├── backups/          ← File backup JSON database
│   ├── dist/             ← Hasil build TypeScript
│   ├── prisma/           ← Schema & migrations
│   ├── uploads/          ← File upload (dokumen proyek)
│   └── src/
├── frontend/             ← ERP-Frontend (Next.js)
│   ├── .env.local        ← Environment variables (JANGAN di-commit!)
│   └── .next/            ← Hasil build Next.js
```

---

*Dokumen ini dibuat untuk Adinata ERP — versi deployment 2026.*
