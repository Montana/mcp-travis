#!/bin/bash

# mcp-travis Setup Script
# coded by michael mendy

set -e 

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_header "Travis CI MCP Server Setup"

echo "This script will:"
echo "  1. Check system requirements"
echo "  2. Install dependencies"
echo "  3. Build the project"
echo "  4. Configure environment variables"
echo "  5. Set up Claude Desktop integration"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

print_header "Step 1: Checking System Requirements"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo ""
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version is too old (found v$NODE_VERSION, need v18+)"
    echo ""
    echo "Please upgrade Node.js from: https://nodejs.org/"
    exit 1
fi

print_success "Node.js $(node -v) found"

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

print_success "npm $(npm -v) found"

print_header "Step 2: Installing Dependencies"

print_info "Running npm install..."
if npm install; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

print_header "Step 3: Building Project"

print_info "Running npm run build..."
if npm run build; then
    print_success "Project built successfully"
else
    print_error "Build failed"
    exit 1
fi

# Step 4: Configure environment
print_header "Step 4: Configuring Environment"

if [ -f ".env" ]; then
    print_warning ".env file already exists"
    read -p "Overwrite? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Keeping existing .env file"
    else
        rm .env
    fi
fi

if [ ! -f ".env" ]; then
    echo ""
    echo "You need a Travis CI API token. Get one from:"
    echo "  1. Go to https://travis-ci.com"
    echo "  2. Click your profile → Settings"
    echo "  3. Find 'API authentication' section"
    echo "  4. Copy your token"
    echo ""
    read -p "Enter your Travis CI API token: " TRAVIS_TOKEN

    if [ -z "$TRAVIS_TOKEN" ]; then
        print_error "No token provided. You'll need to configure .env manually."
        cp .env.example .env
    else
        cat > .env << EOF
TRAVIS_API_URL=https://api.travis-ci.com
TRAVIS_API_TOKEN=$TRAVIS_TOKEN
TRAVIS_USER_AGENT=mcp-travis/0.1
EOF
        print_success "Created .env file"
    fi
fi

print_header "Step 5: Configuring Claude Desktop"

CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    print_warning "Claude Desktop config directory not found"
    print_info "Skipping Claude Desktop configuration"
    print_info "You'll need to configure it manually later"
else
    print_info "Found Claude Desktop config directory"

    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        BACKUP_FILE="${CLAUDE_CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CLAUDE_CONFIG_FILE" "$BACKUP_FILE"
        print_info "Backed up existing config to: $BACKUP_FILE"
    fi

    if [ -f ".env" ]; then
        TRAVIS_TOKEN=$(grep TRAVIS_API_TOKEN .env | cut -d'=' -f2)
    fi

    # Create or update config
    if [ ! -f "$CLAUDE_CONFIG_FILE" ]; then
        # Create new config
        cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "mcp-travis": {
      "command": "node",
      "args": [
        "$SCRIPT_DIR/dist/index.js"
      ],
      "env": {
        "TRAVIS_API_URL": "https://api.travis-ci.com",
        "TRAVIS_API_TOKEN": "$TRAVIS_TOKEN",
        "TRAVIS_USER_AGENT": "mcp-travis/0.1"
      }
    }
  }
}
EOF
        print_success "Created Claude Desktop config"
    else
        print_info "Updating existing Claude Desktop config"

        python3 << EOF
import json
import sys

config_file = "$CLAUDE_CONFIG_FILE"

try:
    with open(config_file, 'r') as f:
        config = json.load(f)
except:
    config = {}

if 'mcpServers' not in config:
    config['mcpServers'] = {}

config['mcpServers']['mcp-travis'] = {
    "command": "node",
    "args": ["$SCRIPT_DIR/dist/index.js"],
    "env": {
        "TRAVIS_API_URL": "https://api.travis-ci.com",
        "TRAVIS_API_TOKEN": "$TRAVIS_TOKEN",
        "TRAVIS_USER_AGENT": "mcp-travis/0.1"
    }
}

with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print("✓ Updated config successfully")
EOF
        print_success "Updated Claude Desktop config"
    fi
fi

print_header "Setup Complete!"

echo ""
print_success "mcp-travis is ready to use!"
echo ""
echo "Next steps:"
echo "  1. ${YELLOW}Restart Claude Desktop${NC} to load the MCP server"
echo "  2. Try asking Claude:"
echo "     • 'Show me Travis CI stats for travis-ci'"
echo "     • 'Is Travis CI down?'"
echo "     • 'Get logs for build 276783990'"
echo ""
echo "Configuration:"
echo "  • Project directory: $SCRIPT_DIR"
echo "  • Environment file: $SCRIPT_DIR/.env"
echo "  • Claude config: $CLAUDE_CONFIG_FILE"
echo ""
print_info "Run './setup.sh' again anytime to reconfigure"
echo ""