#!/bin/bash

# SuiQuiz Production Deployment Script for Walrus
# This script deploys the SuiQuiz platform to Walrus decentralized hosting

set -e

echo "🚀 Starting SuiQuiz Production Deployment to Walrus..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Walrus CLI is installed
if ! command -v walrus &> /dev/null; then
    print_error "Walrus CLI is not installed. Please install it first:"
    echo "curl -fsSL https://wal.app/install.sh | sh"
    exit 1
fi

print_status "Walrus CLI found: $(walrus --version)"

# Check if we're in the right directory
if [ ! -f "walrus.toml" ]; then
    print_error "walrus.toml not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Build Frontend
print_status "Building frontend..."
cd ui
npm ci
npm run build
print_success "Frontend built successfully"
cd ..

# Step 2: Prepare Backend
print_status "Preparing backend..."
cd gas-station
npm ci --only=production
print_success "Backend prepared successfully"
cd ..

# Step 3: Deploy to Walrus
print_status "Deploying to Walrus..."

# Deploy backend first
print_status "Deploying backend to Walrus..."
walrus deploy --config walrus.toml --target backend

# Deploy frontend
print_status "Deploying frontend to Walrus..."
walrus deploy --config walrus.toml --target frontend

print_success "Deployment completed successfully!"

# Step 4: Verify deployment
print_status "Verifying deployment..."
walrus status --config walrus.toml

print_success "🎉 SuiQuiz Platform deployed to Walrus!"
print_status "Frontend: https://quiz.suiquiz.com"
print_status "Backend API: https://api.suiquiz.com"
print_status "WebSocket: wss://api.suiquiz.com"

echo ""
print_warning "Next steps:"
echo "1. Update DNS records to point to Walrus IPs"
echo "2. Configure SSL certificates"
echo "3. Update environment variables with production values"
echo "4. Deploy Move contracts to Sui mainnet"
echo "5. Test the deployed application"
