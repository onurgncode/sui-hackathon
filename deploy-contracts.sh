#!/bin/bash

# SuiQuiz Move Contracts Deployment Script for Mainnet
# This script deploys the Move contracts to Sui mainnet

set -e

echo "🚀 Starting SuiQuiz Move Contracts Deployment to Mainnet..."

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

# Check if Sui CLI is installed
if ! command -v sui &> /dev/null; then
    print_error "Sui CLI is not installed. Please install it first:"
    echo "curl -fsSL https://get.sui.io/install | sh"
    exit 1
fi

print_status "Sui CLI found: $(sui --version)"

# Check if we're in the right directory
if [ ! -f "move/Move.toml" ]; then
    print_error "move/Move.toml not found. Please run this script from the project root."
    exit 1
fi

# Check if we're on mainnet
print_status "Checking Sui network configuration..."
CURRENT_NETWORK=$(sui client active-env)
if [ "$CURRENT_NETWORK" != "mainnet" ]; then
    print_warning "Current network is $CURRENT_NETWORK, switching to mainnet..."
    sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
    sui client switch --env mainnet
fi

print_status "Active network: $(sui client active-env)"

# Check if we have a mainnet address
print_status "Checking for mainnet address..."
ADDRESSES=$(sui client addresses)
if [ -z "$ADDRESSES" ]; then
    print_error "No addresses found. Please create a new address:"
    echo "sui client new-address ed25519"
    exit 1
fi

print_status "Available addresses:"
echo "$ADDRESSES"

# Check if we have SUI for gas
print_status "Checking SUI balance..."
ACTIVE_ADDRESS=$(sui client active-address)
BALANCE=$(sui client balance)
print_status "Active address: $ACTIVE_ADDRESS"
print_status "SUI balance: $BALANCE"

# Deploy contracts
print_status "Deploying Move contracts to mainnet..."

cd move

# Build the package
print_status "Building Move package..."
sui move build

# Publish the package
print_status "Publishing package to mainnet..."
PUBLISH_RESULT=$(sui client publish --gas-budget 100000000)

# Extract package ID from publish result
PACKAGE_ID=$(echo "$PUBLISH_RESULT" | grep -o 'packageId: [a-f0-9x]*' | cut -d' ' -f2)

if [ -z "$PACKAGE_ID" ]; then
    print_error "Failed to extract package ID from publish result"
    echo "Publish result: $PUBLISH_RESULT"
    exit 1
fi

print_success "Package published successfully!"
print_status "Package ID: $PACKAGE_ID"

# Extract object IDs for admin caps
print_status "Extracting object IDs..."

# Get all created objects
CREATED_OBJECTS=$(echo "$PUBLISH_RESULT" | grep -o 'objectId: [a-f0-9x]*' | cut -d' ' -f2)

# Find admin cap (usually the first object after package)
ADMIN_CAP_ID=$(echo "$CREATED_OBJECTS" | head -n 1)

print_success "Admin Cap ID: $ADMIN_CAP_ID"

cd ..

# Update environment files with new IDs
print_status "Updating environment files..."

# Update backend env.production
sed -i "s/TBD_MAINNET_QUIZ_PACKAGE_ID/$PACKAGE_ID/g" gas-station/env.production
sed -i "s/TBD_MAINNET_BADGE_PACKAGE_ID/$PACKAGE_ID/g" gas-station/env.production
sed -i "s/TBD_MAINNET_QUIZ_ROOM_PACKAGE_ID/$PACKAGE_ID/g" gas-station/env.production
sed -i "s/TBD_MAINNET_BADGE_ADMIN_CAP_ID/$ADMIN_CAP_ID/g" gas-station/env.production

# Update walrus.toml
sed -i "s/TBD_MAINNET_QUIZ_PACKAGE_ID/$PACKAGE_ID/g" walrus.toml
sed -i "s/TBD_MAINNET_BADGE_PACKAGE_ID/$PACKAGE_ID/g" walrus.toml
sed -i "s/TBD_MAINNET_QUIZ_ROOM_PACKAGE_ID/$PACKAGE_ID/g" walrus.toml
sed -i "s/TBD_MAINNET_BADGE_ADMIN_CAP_ID/$ADMIN_CAP_ID/g" walrus.toml

print_success "Environment files updated!"

# Create deployment summary
cat > deployment-summary.md << EOF
# SuiQuiz Mainnet Deployment Summary

## Contract Deployment
- **Package ID**: $PACKAGE_ID
- **Admin Cap ID**: $ADMIN_CAP_ID
- **Network**: mainnet
- **RPC URL**: https://fullnode.mainnet.sui.io:443

## Explorer Links
- **Package**: https://suiexplorer.com/object/$PACKAGE_ID?network=mainnet
- **Admin Cap**: https://suiexplorer.com/object/$ADMIN_CAP_ID?network=mainnet

## Next Steps
1. Update production environment variables
2. Deploy frontend and backend to Walrus
3. Configure domain and SSL
4. Test the deployed application

## Environment Variables Updated
- gas-station/env.production
- walrus.toml

EOF

print_success "🎉 Move contracts deployed to mainnet successfully!"
print_status "Package ID: $PACKAGE_ID"
print_status "Admin Cap ID: $ADMIN_CAP_ID"
print_status "Deployment summary saved to: deployment-summary.md"

echo ""
print_warning "Next steps:"
echo "1. Update production environment variables with real values"
echo "2. Deploy to Walrus using: ./deploy.sh"
echo "3. Configure domain and SSL certificates"
echo "4. Test the deployed application"
