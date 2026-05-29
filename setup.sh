#!/bin/bash

echo "🚀 Setting up PR Review Agent..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if yarn is installed
if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn is not installed. Please install Yarn"
    exit 1
fi

echo "✓ Yarn version: $(yarn --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Rebuild native modules
echo "🔨 Building native modules..."
yarn rebuild better-sqlite3

if [ $? -ne 0 ]; then
    echo "❌ Failed to rebuild better-sqlite3"
    exit 1
fi

echo "✓ Native modules built"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created (please configure it)"
else
    echo "✓ .env file already exists"
fi

echo ""

# Create data directory
mkdir -p data
mkdir -p logs
echo "✓ Data directories created"
echo ""

# Build UI
echo "🎨 Building UI..."
yarn ui:build

if [ $? -ne 0 ]; then
    echo "⚠ Failed to build UI (you can build it later with: yarn ui:build)"
else
    echo "✓ UI built successfully"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Configure .env file with your settings"
echo "  2. Run the app: yarn app:dev"
echo ""
echo "For more information, see:"
echo "  - README.md - General usage"
echo "  - RUNNING.md - Running instructions"
echo "  - TROUBLESHOOTING.md - Common issues"
