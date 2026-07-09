# 🌐 24/7 Live Website Monitor & Keep-Alive Service

A high-performance, full-stack website uptime monitor and keep-alive service. It periodically pings critical endpoints (like CodeSandbox, GitHub Codespaces, or personal VPS servers) at custom intervals to ensure they stay active, record uptime statistics, and prevent sleep cycles—even when you close your browser.

This guide provides step-by-step instructions for deploying this application on your own **Virtual Private Server (VPS)** to run continuously 24/7.

---

## 📋 Prerequisites

Before starting, make sure your VPS has the following installed:
1. **Git** (to clone the repository)
2. **Node.js** (v18 or higher recommended)
3. **npm** (comes packaged with Node.js)
4. **PM2** (production process manager for Node.js to keep the app running 24/7)

---

## 🚀 Step-by-Step VPS Deployment

### Step 1: Clone the Repository
Connect to your VPS via SSH and clone the project directory:
```bash
git clone <YOUR_REPOSITORY_GIT_URL>
cd <REPOSITORY_FOLDER_NAME>
```

*(Note: Replace `<YOUR_REPOSITORY_GIT_URL>` with your actual Git clone URL and `<REPOSITORY_FOLDER_NAME>` with the directory name.)*

---

### Step 2: Install Dependencies
Run the install command to fetch all server and client packages:
```bash
npm install
```

---

### Step 3: Configure Environment Variables
Create a `.env` file at the root of your project using the `.env.example` as a template:
```bash
cp .env.example .env
```

Open the `.env` file using your favorite editor (e.g., `nano` or `vim`) and customize the variables:
```env
# The URL where your VPS monitor app is hosted (e.g., your VPS IP or custom domain)
APP_URL="http://your-vps-ip:3000"

# Optional: Add your Gemini API Key if you use AI assistant modules
GEMINI_API_KEY="your-gemini-api-key"
```

---

### Step 4: Build the Production Application
Compile the React frontend with Vite and bundle the Express server with esbuild into a single production file:
```bash
npm run build
```
This script does two things:
1. Compiles your static web files to the `dist/` directory.
2. Compiles and bundles `server.ts` into a production-optimized CommonJS file: `dist/server.cjs`.

---

### Step 5: Run the App 24/7 with PM2 (Process Manager)

To ensure the server runs forever, handles unexpected crashes, and automatically starts up if your VPS reboots, we use **PM2**.

1. **Install PM2 globally (if you haven't already):**
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the application with PM2:**
   Navigate to the project root and launch the compiled server:
   ```bash
   pm2 start dist/server.cjs --name "uptime-monitor" --env production
   ```

3. **Enable PM2 Startup Hook (Survives Server Reboots):**
   Generate and configure the startup script so the monitor boots automatically when the VPS restarts:
   ```bash
   pm2 startup
   ```
   *Copy and run the command printed by the terminal output (it will look like `sudo env PATH=$PATH...`).*

4. **Save Current PM2 List:**
   Freeze your active process list so it persists:
   ```bash
   pm2 save
   ```

5. **Useful PM2 Commands:**
   - View live logs: `pm2 logs uptime-monitor`
   - Check application status: `pm2 status`
   - Restart the application: `pm2 restart uptime-monitor`
   - Stop the application: `pm2 stop uptime-monitor`

---

## 🔒 Step 6: Setting up Nginx Reverse Proxy (Optional)

To point a beautiful custom domain (e.g., `https://monitor.yourdomain.com`) to your monitor instead of accessing it via port `3000`, set up an Nginx reverse proxy with SSL.

1. **Install Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx -y
   ```

2. **Create an Nginx configuration file:**
   ```bash
   sudo nano /etc/nginx/sites-available/uptime-monitor
   ```

3. **Paste the following configuration (replace `monitor.yourdomain.com` with your domain):**
   ```nginx
   server {
       listen 80;
       server_name monitor.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Enable the site and restart Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/uptime-monitor /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Acquire a free SSL Certificate with Let's Encrypt Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d monitor.yourdomain.com
   ```
   Follow the on-screen prompts to automatically upgrade your proxy to secure **HTTPS**.

---

## ⚡ Active Target Configurations
When adding target applications to monitor, verify their port settings:
* **CodeSandbox:** Ensure the sandbox port is set to **Public** so our server can reach it past the login screen.
* **GitHub Codespaces:** In the **Ports** tab next to your terminal, right-click the active port and switch visibility to **Public** to prevent keep-alive visits from getting blocked by the GitHub auth screen.
