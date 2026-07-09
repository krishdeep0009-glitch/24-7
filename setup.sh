#!/bin/bash

# ==============================================================================
# 🌐 24/7 Live Website Monitor - All-In-One VPS Installer Script
# ==============================================================================
# This script automates system checks, repository cloning, dependency
# installation, production builds, and process daemonization using PM2.
# Ideal for setups behind Cloudflare Zero Trust Tunnels on port 3000.
# ==============================================================================

# Text Formatting Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}${BOLD}======================================================================${NC}"
echo -e "${CYAN}${BOLD}      🚀 24/7 Live Website Monitor - All-In-One VPS Installer         ${NC}"
echo -e "${CYAN}${BOLD}======================================================================${NC}"
echo -e "Target Port: ${GREEN}3000${NC} (Perfect for Cloudflare Zero Trust Tunnels)"
echo -e "Repository:  ${GREEN}https://github.com/krishdeep0009-glitch/24-7.git${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

# --- 1. PREREQUISITE CHECKS ---
echo -e "${BLUE}[1/5] Checking System Prerequisites...${NC}"

# Check for Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️ Git is not installed. Installing git...${NC}"
    sudo apt update && sudo apt install git -y
else
    echo -e "${GREEN}✓ Git is already installed.${NC}"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️ Node.js is not installed. Installing Node.js LTS (v20)...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js is installed (${NODE_VERSION}).${NC}"
fi

# Check for NPM
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️ npm is not installed. Installing npm...${NC}"
    sudo apt install -y npm
else
    echo -e "${GREEN}✓ npm is installed.${NC}"
fi

# --- 2. CLONE REPOSITORY ---
echo -e "\n${BLUE}[2/5] Setting up project directory...${NC}"
REPO_URL="https://github.com/krishdeep0009-glitch/24-7.git"
DIR_NAME="24-7"

if [ -d "$DIR_NAME" ]; then
    echo -e "${YELLOW}⚠️ Directory '$DIR_NAME' already exists. Navigating inside and updating files...${NC}"
    cd "$DIR_NAME" || exit
    git reset --hard
    git pull
else
    # Check if we are already inside the cloned directory (running script locally)
    if [ -f "package.json" ] && [ -f "server.ts" ] && [[ $(git config --get remote.origin.url) == *"$DIR_NAME"* || -d ".git" ]]; then
        echo -e "${GREEN}✓ Already inside the project directory.${NC}"
    else
        echo -e "${CYAN}Cloning repository into '$DIR_NAME'...${NC}"
        git clone "$REPO_URL" "$DIR_NAME"
        cd "$DIR_NAME" || exit
    fi
fi

# --- 3. INSTALL DEPENDENCIES ---
echo -e "\n${BLUE}[3/5] Installing Project Dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Dependency installation failed! Check logs above.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependencies successfully installed.${NC}"

# --- 4. BUILD PRODUCTION APP ---
echo -e "\n${BLUE}[4/5] Compiling Production Build...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Build failed! Please review syntax or typescript errors above.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ React Frontend & Express Server successfully compiled to dist/.${NC}"

# --- 5. SETUP PROCESS MANAGER (PM2) ---
echo -e "\n${BLUE}[5/5] Launching with PM2 Daemon...${NC}"

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    echo -e "${CYAN}Installing PM2 globally for 24/7 background operation...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}✓ PM2 process manager is already installed.${NC}"
fi

# Stop any existing instance to avoid port binding conflicts
pm2 stop "uptime-monitor" &> /dev/null
pm2 delete "uptime-monitor" &> /dev/null

# Start application using compiled server bundle
echo -e "${CYAN}Starting Uptime Monitor...${NC}"
pm2 start dist/server.cjs --name "uptime-monitor" --env production

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Application is successfully running in the background!${NC}"
else
    echo -e "${RED}❌ Error: Failed to start application with PM2.${NC}"
    exit 1
fi

# Save state for system reboots
echo -e "\n${CYAN}Configuring system startup persistence...${NC}"
pm2 save

echo -e "\n${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 SETUP COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "Your Website Monitor is now running ${BOLD}24/7${NC} on port ${BOLD}3000${NC}!"
echo -e ""
echo -e "📊 ${BOLD}Monitor Control Commands:${NC}"
echo -e "   • Check Status:   ${CYAN}pm2 status${NC}"
echo -e "   • Live Logs:      ${CYAN}pm2 logs uptime-monitor${NC}"
echo -e "   • Restart App:    ${CYAN}pm2 restart uptime-monitor${NC}"
echo -e "   • Stop App:       ${CYAN}pm2 stop uptime-monitor${NC}"
echo -e ""
echo -e "☁️ ${BOLD}Cloudflare Tunnel Guide:${NC}"
echo -e "   Point your Cloudflare Tunnel hostname securely to: ${BOLD}http://localhost:3000${NC}"
echo -e "${GREEN}======================================================================${NC}\n"
