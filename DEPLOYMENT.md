# SuiQuiz Production Deployment Guide

Bu doküman SuiQuiz platformunu production ortamına deploy etmek için gerekli adımları açıklar.

## 🚀 Deployment Adımları

### 1. Move Contract'ları Mainnet'e Deploy Et

```bash
# Contract'ları mainnet'e deploy et
chmod +x deploy-contracts.sh
./deploy-contracts.sh
```

Bu script:
- Move package'ını mainnet'e publish eder
- Package ID ve Admin Cap ID'lerini çıkarır
- Environment dosyalarını günceller

### 2. Production Environment Variables'ları Güncelle

#### Backend (gas-station/env.production)
```bash
# Gerçek production değerlerini güncelle:
# - ENOKI_API_KEY (Enoki dashboard'dan al)
# - ENOKI_PRIVATE_KEY (Enoki dashboard'dan al)
# - GOOGLE_CLIENT_ID (Google Cloud Console'dan al)
# - GOOGLE_CLIENT_SECRET (Google Cloud Console'dan al)
# - JWT_SECRET (güçlü bir secret oluştur)
```

#### Frontend (ui/env.production)
```bash
# Gerçek production değerlerini güncelle:
# - VITE_GOOGLE_CLIENT_ID (Google Cloud Console'dan al)
```

### 3. Walrus'a Deploy Et

```bash
# Walrus CLI'yi kur (eğer kurulu değilse)
curl -fsSL https://wal.app/install.sh | sh

# Walrus'a deploy et
chmod +x deploy.sh
./deploy.sh
```

### 4. Domain ve SSL Konfigürasyonu

1. **Domain Satın Al**: `suiquiz.com` (veya tercih ettiğin domain)
2. **DNS Kayıtları**:
   - `quiz.suiquiz.com` → Frontend IP
   - `api.suiquiz.com` → Backend IP
3. **SSL Sertifikası**: Walrus otomatik olarak Let's Encrypt ile SSL sağlar

### 5. Production Test

```bash
# Health check
curl https://api.suiquiz.com/health

# Frontend test
curl https://quiz.suiquiz.com
```

## 📁 Dosya Yapısı

```
├── walrus.toml              # Walrus deployment konfigürasyonu
├── deploy.sh                # Walrus deployment script'i
├── deploy-contracts.sh      # Move contract deployment script'i
├── gas-station/
│   ├── env.production       # Backend production environment
│   └── server.js           # Backend server (health check eklendi)
├── ui/
│   └── env.production      # Frontend production environment
└── move/                   # Move contract'ları
```

## 🔧 Environment Variables

### Backend (gas-station/env.production)
- `NODE_ENV=production`
- `SUI_NETWORK=mainnet`
- `SUI_RPC_URL=https://fullnode.mainnet.sui.io:443`
- `FRONTEND_URL=https://quiz.suiquiz.com`
- `QUIZ_PACKAGE_ID` (deploy-contracts.sh ile güncellenir)
- `BADGE_PACKAGE_ID` (deploy-contracts.sh ile güncellenir)
- `QUIZ_ROOM_PACKAGE_ID` (deploy-contracts.sh ile güncellenir)
- `BADGE_ADMIN_CAP_ID` (deploy-contracts.sh ile güncellenir)
- `ENOKI_API_KEY` (Enoki dashboard'dan al)
- `ENOKI_PRIVATE_KEY` (Enoki dashboard'dan al)
- `GOOGLE_CLIENT_ID` (Google Cloud Console'dan al)
- `GOOGLE_CLIENT_SECRET` (Google Cloud Console'dan al)
- `GOOGLE_REDIRECT_URI=https://quiz.suiquiz.com`
- `JWT_SECRET` (güçlü bir secret oluştur)
- `WALRUS_URL=https://wal.app`
- `WALRUS_RPC_URL=https://rpc.wal.app`

### Frontend (ui/env.production)
- `VITE_GOOGLE_CLIENT_ID` (Google Cloud Console'dan al)
- `VITE_GOOGLE_REDIRECT_URI=https://quiz.suiquiz.com`
- `VITE_SUI_NETWORK=mainnet`
- `VITE_SUI_RPC_URL=https://fullnode.mainnet.sui.io:443`
- `VITE_API_BASE_URL=https://api.suiquiz.com`
- `VITE_WS_URL=https://api.suiquiz.com`

## 🎯 Production Checklist

- [ ] Move contract'ları mainnet'e deploy edildi
- [ ] Package ID'ler environment dosyalarına eklendi
- [ ] Enoki production key'leri eklendi
- [ ] Google OAuth production key'leri eklendi
- [ ] JWT secret güçlü bir değerle güncellendi
- [ ] Walrus'a deploy edildi
- [ ] Domain DNS kayıtları yapılandırıldı
- [ ] SSL sertifikası aktif
- [ ] Health check endpoint çalışıyor
- [ ] Frontend ve backend erişilebilir
- [ ] Google login çalışıyor
- [ ] Quiz oluşturma çalışıyor
- [ ] Real-time oyun çalışıyor
- [ ] Badge sistemi çalışıyor

## 🚨 Troubleshooting

### Contract Deployment Hatası
```bash
# SUI balance kontrol et
sui client balance

# Gas budget artır
sui client publish --gas-budget 200000000
```

### Walrus Deployment Hatası
```bash
# Walrus CLI versiyonunu kontrol et
walrus --version

# Log'ları kontrol et
walrus logs --config walrus.toml
```

### Environment Variable Hatası
```bash
# Environment dosyalarını kontrol et
cat gas-station/env.production
cat ui/env.production
```

## 📞 Support

Deployment sırasında sorun yaşarsan:
1. Log'ları kontrol et
2. Environment variable'ları doğrula
3. Network bağlantısını test et
4. Sui Explorer'da transaction'ları kontrol et

## 🔗 Useful Links

- [Sui Explorer](https://suiexplorer.com)
- [Walrus Documentation](https://docs.wal.app)
- [Enoki Dashboard](https://dashboard.enoki.com)
- [Google Cloud Console](https://console.cloud.google.com)
