# Web Frontend Build and Runtime Instructions (Office Server PC)

**Target Environment:** Office Server PC (Windows)  
**Service:** Next.js 15.5.25 / React 18 Web Application  
**Internal Port:** `3000`  
**External Route:** `https://192.168.1.4:8444/*` (Reverse-proxied via Caddy / Nginx)  

---

## 1. Prerequisites on Office Server PC
- **Node.js:** v18.x or v20.x LTS installed
- **npm:** v9.x+ or v10.x+
- **Backend Service:** Running on port `5000`

---

## 2. Environment Configuration (`web/.env.production`)
Create or verify `web/.env.production` on the office server PC:
```env
NEXT_PUBLIC_API_URL=/api
BACKEND_INTERNAL_URL="http://127.0.0.1:5000"
NEXT_PUBLIC_ENABLE_DEMO_LOGINS=false
PORT=3000
NODE_ENV=production
```
*Note: Browser requests automatically use relative URL `/api/*`, which the reverse proxy directs to backend port 5000. No client IP address hardcoding is necessary.*

---

## 3. Build & Execution Steps
From the `web/` directory on the office server PC:

```powershell
# 1. Install dependencies
npm ci

# 2. Build Next.js production bundle
npm run build

# 3. Start Next.js production server
npm run start
```

---

## 4. Verification Check
Verify frontend loads locally:
```powershell
curl http://127.0.0.1:3000/
# Or via office Wi-Fi reverse proxy:
curl -k https://192.168.1.4:8444/
```
Open `https://192.168.1.4:8444` in any web browser on the office Wi-Fi network.
