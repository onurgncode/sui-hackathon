# SuiQuiz Production Deployment Script for Windows PowerShell
# This script deploys the SuiQuiz platform to Walrus decentralized hosting

Write-Host "🚀 Starting SuiQuiz Production Deployment to Walrus..." -ForegroundColor Blue

# Check if Walrus CLI is installed
try {
    $walrusVersion = walrus --version
    Write-Host "✅ Walrus CLI found: $walrusVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Walrus CLI is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "curl -fsSL https://wal.app/install.sh | sh" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "walrus.toml")) {
    Write-Host "❌ walrus.toml not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

# Step 1: Build Frontend
Write-Host "📦 Building frontend..." -ForegroundColor Blue
Set-Location ui
npm ci
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend built successfully" -ForegroundColor Green
Set-Location ..

# Step 2: Prepare Backend
Write-Host "⚙️ Preparing backend..." -ForegroundColor Blue
Set-Location gas-station
npm ci --only=production
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend preparation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend prepared successfully" -ForegroundColor Green
Set-Location ..

# Step 3: Deploy to Walrus
Write-Host "🌊 Deploying to Walrus..." -ForegroundColor Blue

# Deploy backend first
Write-Host "🚀 Deploying backend to Walrus..." -ForegroundColor Blue
walrus deploy --config walrus.toml --target backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend deployment failed" -ForegroundColor Red
    exit 1
}

# Deploy frontend
Write-Host "🎨 Deploying frontend to Walrus..." -ForegroundColor Blue
walrus deploy --config walrus.toml --target frontend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green

# Step 4: Verify deployment
Write-Host "🔍 Verifying deployment..." -ForegroundColor Blue
walrus status --config walrus.toml

Write-Host "🎉 SuiQuiz Platform deployed to Walrus!" -ForegroundColor Green
Write-Host "🌐 Frontend: https://suiquiz-platform.wal.app" -ForegroundColor Cyan
Write-Host "🔗 Backend API: https://suiquiz-api.wal.app" -ForegroundColor Cyan
Write-Host "📡 WebSocket: wss://suiquiz-api.wal.app" -ForegroundColor Cyan

Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the deployed application" -ForegroundColor White
Write-Host "2. Update Google OAuth redirect URI to: https://suiquiz-platform.wal.app" -ForegroundColor White
Write-Host "3. Share your quiz platform with users!" -ForegroundColor White