Write-Host "Starting SuiQuiz Deployment to Walrus..." -ForegroundColor Blue

# Check Walrus CLI
try {
    walrus --version
    Write-Host "Walrus CLI found" -ForegroundColor Green
} catch {
    Write-Host "Walrus CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Build Frontend
Write-Host "Building frontend..." -ForegroundColor Blue
Set-Location ui
npm ci
npm run build
Set-Location ..

# Deploy to Walrus
Write-Host "Deploying to Walrus..." -ForegroundColor Blue
walrus deploy --config walrus.toml

Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "Frontend: https://suiquiz-platform.wal.app" -ForegroundColor Cyan
Write-Host "Backend: https://suiquiz-api.wal.app" -ForegroundColor Cyan
