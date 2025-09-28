# Vercel Deployment Script for Windows PowerShell

Write-Host "🚀 Starting Vercel Deployment..." -ForegroundColor Green

# Check if Vercel CLI is installed
if (!(Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

# Deploy Backend
Write-Host "📦 Deploying Backend..." -ForegroundColor Yellow
Set-Location "gas-station"
vercel --prod --yes
$backendUrl = Read-Host "Enter your backend Vercel URL (e.g., https://your-backend.vercel.app)"

# Deploy Frontend
Write-Host "🎨 Deploying Frontend..." -ForegroundColor Yellow
Set-Location "../ui"

# Update environment variables for frontend
Write-Host "🔧 Setting Frontend Environment Variables..." -ForegroundColor Cyan
vercel env add VITE_API_BASE_URL production
vercel env add VITE_WS_URL production
vercel env add VITE_SUI_NETWORK production
vercel env add VITE_SUI_RPC_URL production
vercel env add VITE_GOOGLE_CLIENT_ID production
vercel env add VITE_GOOGLE_REDIRECT_URI production

Write-Host "📝 Please set these environment variables in Vercel Dashboard:" -ForegroundColor Magenta
Write-Host "VITE_API_BASE_URL = $backendUrl" -ForegroundColor White
Write-Host "VITE_WS_URL = $backendUrl" -ForegroundColor White
Write-Host "VITE_SUI_NETWORK = testnet" -ForegroundColor White
Write-Host "VITE_SUI_RPC_URL = https://fullnode.testnet.sui.io:443" -ForegroundColor White
Write-Host "VITE_GOOGLE_CLIENT_ID = 20125149505-k6stooabdj31t2lsibg5jq645ge90vbl.apps.googleusercontent.com" -ForegroundColor White
Write-Host "VITE_GOOGLE_REDIRECT_URI = [YOUR_FRONTEND_URL]" -ForegroundColor White

vercel --prod --yes
$frontendUrl = Read-Host "Enter your frontend Vercel URL (e.g., https://your-frontend.vercel.app)"

Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "Backend URL: $backendUrl" -ForegroundColor Cyan
Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Cyan

# Return to root directory
Set-Location ".."
