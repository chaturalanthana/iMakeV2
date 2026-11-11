# iMake

iMake is Pro Logics' multi-tenant mini ERP. Production, materials, procurement, inventory, sales, and finance share one PostgreSQL database.

## Setup

1. Copy the environment examples and set new secrets. The old database password and JWT fallback were in a public repository and must be rotated.

```bash
cp .env.example .env
cp server/.env.example server/.env
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Install dependencies, apply migrations, and generate the Prisma client:

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
npm --prefix server run db:migrate
npm --prefix server exec -- prisma generate
```

4. Run the API and the React app:

```bash
npm run dev
```

The API listens on port 5000. The Vite app listens on port 3000 and proxies `/api`.

## Tests and the production image

```bash
npm --prefix server test
npm --prefix client run build
```

`docker compose --profile app up --build` builds the API together with the client and runs `prisma migrate deploy` on startup.

GitHub Actions installs dependencies, applies migrations, runs the server tests against PostgreSQL 16, and builds the client. There is no lint script yet.

## Access model

Every API route except login, registration, and the health check requires a JWT. The role permissions decide read and write access per module: settings, products, sales, procurement, finance, hr, warehouse, and production. A new tenant receives a Super Admin role (`permissions.all`) plus Sales, Procurement, Warehouse, Production, Finance, and Human Resources roles. Existing Admin and Super Admin roles that have no explicit module list keep full access.

Uploaded BOM files are stored under `server/uploads` and are returned only from `GET /api/uploads/...` after the caller is authenticated and the file belongs to their tenant.

Masters, purchasing, inventory, and sales writes are checked with Zod before the controller runs. A failure looks like `{ "error": "...", "fields": { "name": "..." } }`. Production, finance documents, HR, and settings bodies are not covered by that layer yet.

Stock receipts, issues, transfers, adjustments, goods receipts, and sales deliveries post the document and its stock movements in one database transaction.
