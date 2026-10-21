# Backend Build and Runtime Instructions (Office Server PC)

**Target Environment:** Office Server PC (Windows)  
**Service:** NestJS 10 REST API  
**Internal Port:** `5000`  
**External Route:** `https://192.168.1.4:8444/api/*` (Reverse-proxied via Caddy / Nginx)  
**Database:** PostgreSQL (Staging Port `5433` / HikCentral Production Port `5432` strictly isolated)  

---

## 1. Prerequisites on Office Server PC
- **Node.js:** v18.x or v20.x LTS installed
- **npm:** v9.x+ or v10.x+
- **PostgreSQL:** Running on staging port `5433` (database name: `kanvtech_sm_staging`)

---

## 2. Environment Configuration (`backend/.env`)
Verify the server's existing `backend/.env` file. **Do not overwrite existing secrets.**

Required environment keys:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:<PASSWORD>@localhost:5433/kanvtech_sm_staging?schema=public"
JWT_SECRET="<EXISTING_SERVER_JWT_SECRET>"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="https://192.168.1.4:8444,https://staging.kanvtech.com,http://localhost:3000,http://127.0.0.1:3000"
SWAGGER_ENABLED=false
NODE_ENV="production"
STORAGE_DRIVER="local"
UPLOAD_DIR="./uploads"
```

---

## 3. Build & Execution Steps
From the `backend/` directory on the office server PC:

```powershell
# 1. Install dependencies (preserving exact lockfile)
npm ci

# 2. Generate Prisma Client (strictly code-generation only, no database migration)
npx prisma generate

# 3. Compile NestJS production build
npm run build

# 4. Start production service
npm run start:prod
```

---

## 4. Health Check
Verify backend API responds on localhost:
```powershell
curl http://127.0.0.1:5000/api/auth/profile
# Or verify reverse proxy:
curl -k https://192.168.1.4:8444/api/auth/profile
```
