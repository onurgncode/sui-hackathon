# 🚀 Vercel Deployment Guide

## Frontend Deployment (UI)

### 1. Vercel'de Frontend Projesi Oluştur
```bash
# Vercel CLI ile
vercel --prod

# Veya Vercel Dashboard'dan
# https://vercel.com/dashboard
```

### 2. Environment Variables Ayarla
Vercel Dashboard > Project Settings > Environment Variables:

```
VITE_API_BASE_URL = https://your-backend-url.vercel.app
VITE_WS_URL = https://your-backend-url.vercel.app
VITE_SUI_NETWORK = testnet
VITE_SUI_RPC_URL = https://fullnode.testnet.sui.io:443
VITE_GOOGLE_CLIENT_ID = 20125149505-k6stooabdj31t2lsibg5jq645ge90vbl.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI = https://your-frontend-url.vercel.app
```

### 3. Build Settings
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

---

## Backend Deployment (Gas Station)

### 1. Vercel'de Backend Projesi Oluştur
```bash
cd gas-station
vercel --prod
```

### 2. Environment Variables Ayarla
```
QUIZ_PACKAGE_ID = 0xcc56ad1275ac682e8472de9ee1fff17348c10342fbbb996359d3cffd20efc05c
BADGE_PACKAGE_ID = 0xcc56ad1275ac682e8472de9ee1fff17348c10342fbbb996359d3cffd20efc05c
QUIZ_ROOM_PACKAGE_ID = 0xcc56ad1275ac682e8472de9ee1fff17348c10342fbbb996359d3cffd20efc05c
BADGE_ADMIN_CAP_ID = 0xcc56ad1275ac682e8472de9ee1fff17348c10342fbbb996359d3cffd20efc05c
ENOKI_API_KEY = your_enoki_api_key_here
WALRUS_API_URL = https://testnet.wal.app
SUI_RPC_URL = https://fullnode.testnet.sui.io:443
NODE_ENV = production
```

### 3. Build Settings
- **Framework Preset**: Other
- **Build Command**: `npm run build`
- **Output Directory**: `.`
- **Install Command**: `npm install`

---

## Deployment Sırası

1. **Önce Backend'i Deploy Et**
   - Backend URL'ini not et
   - Environment variables'ları ayarla

2. **Sonra Frontend'i Deploy Et**
   - Backend URL'ini frontend environment variables'larına ekle
   - Frontend URL'ini backend'e ekle (gerekirse)

3. **Test Et**
   - Frontend'den backend'e bağlantı test et
   - Quiz oluşturma test et
   - WebSocket bağlantısı test et

---

## Troubleshooting

### 404 Hatası
- Environment variables'ların doğru ayarlandığından emin ol
- Backend URL'inin doğru olduğundan emin ol
- CORS ayarlarını kontrol et

### WebSocket Bağlantı Hatası
- Vercel'de WebSocket desteği için Serverless Functions kullan
- Socket.io'nun Vercel'de çalışması için özel ayarlar gerekebilir

### Build Hatası
- Node.js version'ını kontrol et (>=18.0.0)
- Dependencies'leri kontrol et
- TypeScript hatalarını düzelt
