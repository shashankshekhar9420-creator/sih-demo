# Sahaj (सहज) - System & Deployment Requirements

This document outlines the complete system, environment, runtime, and architecture requirements to run, test, and deploy the **Sahaj** monorepo application.

---

## 1. System & Runtime Requirements

### Minimum Hardware
| Resource | Minimum | Recommended (Production / VPS) |
| :--- | :--- | :--- |
| **CPU** | 2 cores (x86_64 / ARM64) | 2+ cores |
| **RAM** | 4 GB | 8 GB |
| **Disk Space** | 2 GB free disk space | 10 GB+ (depending on upload volume) |

### Supported Operating Systems
- **Windows**: Windows 10 / 11 (PowerShell 5.1+ or PowerShell Core, cmd, or WSL2)
- **macOS**: macOS 12+ (Apple Silicon or Intel)
- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 38+, Alpine 3.18+

### Software & Tooling
| Tool | Minimum Version | Recommended Version | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.0.0` | `v22.x LTS` (or `v24.x`) | Active LTS recommended. Supports native `node:test`. |
| **npm** | `v9.0.0` | `v10.x` or `v11.x` | Required for npm workspaces (`apps/*`, `packages/*`). |
| **Git** | `v2.30+` | Latest | For repository version control and GitHub deployments. |
| **Docker** *(optional)* | `v24.0+` | Latest with Compose v2 | Recommended for multi-container deployment on VPS/cloud. |

### Browser Requirements (End Users & Testing)
- **Desktop/Mobile Browsers**: Google Chrome (v100+), Mozilla Firefox (v100+), Apple Safari (v16+), Microsoft Edge (v100+).
- **Required Browser APIs**:
  - `navigator.mediaDevices.getUserMedia` (for voice recording via microphone and camera capture)
  - `MediaRecorder` API (for capturing `audio/webm`, `audio/wav`, or `audio/ogg`)
  - HTML5 File API & Drag-and-Drop
  - JavaScript ES2022+ enabled

---

## 2. Network & Port Allocation

By default, the two connected Next.js applications run on separate loopback ports:

| Service | Default Local Port | Default Local URL | Purpose |
| :--- | :--- | :--- | :--- |
| **Commerce Marketplace** | `3000` | `http://localhost:3000` | Buyer storefront & seller management dashboard |
| **Artisan Studio** | `4000` | `http://localhost:4000` | Step-by-step cataloging wizard, voice recording & uploads |

> **Important**: When deploying to production or hosting across different domains/subdomains, ensure both services can reach each other via their configured URLs without firewall blocks.

---

## 3. Environment Variables Matrix

All configuration parameters have safe defaults for local development. For production or GitHub deployment, the following variables can be configured:

| Variable | Scope | Default Value | Description / Production Recommendation |
| :--- | :--- | :--- | :--- |
| `COMMERCE_APP_URL` | Shared (Server-side) | `http://localhost:3000` | The public or internal URL where Commerce is accessible. |
| `ARTISAN_APP_URL` | Shared (Server-side) | `http://localhost:4000` | The public or internal URL where Artisan Studio is accessible. |
| `DEMO_API_KEY` | Shared (Server-side) | `local-demo-key` | Shared secret header (`x-demo-api-key`) for server-to-server publishing. Rotate in production. |
| `DEMO_SELLER_ID` | Shared | `seller-demo` | Fixed seller identity for the prototype integration. |
| `DEMO_SELLER_EMAIL` | Commerce | `demo@sahaj-market.test` | Default seller dashboard credentials. |
| `DEMO_SELLER_PASSWORD` | Commerce | `demo123` | Default seller dashboard password. |
| `DEMO_SESSION_SECRET` | Commerce | `sahaj-local-only-change-before-deployment-2026` | Secret string for HMAC signing the HTTP-only demo seller session cookie. **Must be rotated in production.** |
| `NODE_ENV` | Global | `development` | Set to `production` during builds and live runtime. |
| `PORT` | Next.js | `3000` / `4000` | Service listener port. |

> 🔒 **Security Rule**: None of these variables use the `NEXT_PUBLIC_` prefix. They must **never** be exposed to client-side bundles.

---

## 4. Architectural & Monorepo Requirements

The workspace utilizes **npm workspaces**:

```text
sahaj-demo/
├── package.json           # Root workspace config and orchestrator scripts
├── packages/
│   └── shared/            # Shared types, Zod schemas, constants, Indian rupee helpers
└── apps/
    ├── commerce/          # Next.js 15 App Router (Buyer + Seller Dashboard)
    └── artisan/           # Next.js 15 App Router (Voice-first Artisan Studio)
```

1. **Workspace Hoisting**: Both apps import from `@sahaj/shared` via workspace linkage.
2. **Next.js Transpilation**: Both `next.config.ts` files must specify `transpilePackages: ['@sahaj/shared']`.
3. **Isolated Prisma Clients**:
   - `apps/commerce/prisma/schema.prisma` generates into `apps/commerce/generated/client`
   - `apps/artisan/prisma/schema.prisma` generates into `apps/artisan/generated/client`
   - This prevents race conditions and client schema collisions during concurrent builds.

---

## 5. Storage & Persistence Requirements

### Database Persistence (SQLite)
- **Commerce Database**: `apps/commerce/prisma/commerce.db`
- **Artisan Database**: `apps/artisan/prisma/artisan.db`
- **Setup Requirements**:
  - `prisma generate`: Generates TypeScript Prisma Client code into each app's `generated/client` directory.
  - `prisma db push`: Applies SQLite schema migrations directly.
  - `tsx prisma/seed.ts`: Seeds default sellers, curated products, and initial orders.
- **Production Note**: On containerized or cloud platforms (Render, Railway, Fly.io, VPS), database files must reside on a **persistent mounted volume**; otherwise, restarts will reset data.

### Media & Uploads Storage
- **Artisan Uploads**: Saved to `apps/artisan/public/uploads/{catalogId}/`
- **Static Seed Artwork**: Served locally from `apps/commerce/public/art/*.svg`
- **Production Requirement**: When deployed to serverless platforms (like basic Vercel), local filesystem writes are ephemeral. For a permanent cloud deployment, use a persistent Docker volume or configure an S3/R2 object storage adapter.

---

## 6. Functional & Domain Specifications

1. **Fixed Categories**: Exactly 11 categories:
   - Pottery & Terracotta
   - Handloom & Weaving
   - Woodcraft & Carving
   - Metal & Brass Craft
   - Leathercraft
   - Stone Craft
   - Bamboo, Cane & Natural Fiber
   - Traditional Painting & Art
   - Jewelry & Beaded Craft
   - Festive & Ritual Crafts
   - Other
2. **Catalog Creation Contract**:
   - Exactly **3 photos** per product (main angle, detail/side, texture/close-up) in PNG, JPEG, or WebP format (max 10MB each).
   - Exactly **3 audio recordings** answering three standard Hindi craft questions.
   - Deterministic bilingual catalog generation (English + Hindi titles, descriptions, bullet points, specifics, and search keywords).
   - Transparent pricing calculation: `Recommended Price = Material Cost × 2`.
3. **Publishing Contract**:
   - Server-to-server HTTP call from Artisan Studio to Commerce (`POST /api/artisan/catalogs/publish`).
   - Idempotent upsert by `artisanCatalogId`: republishing updates existing records without duplicating listings or breaking canonical URLs.
4. **Order Management**:
   - Direct transactional checkout ("Buy Now") decrements inventory atomically and generates a secure private receipt token.
   - Orders update synchronously in the Seller Dashboard and can be queried by Artisan Studio.

---

## 7. Quality & Verification Gates

Before pushing to GitHub or deploying to production, the repository must pass all validation gates:

```bash
# 1. Integration contract & shared schema tests
npm test

# 2. Commerce dependency-free static assertions
node apps/commerce/tests/static.test.mjs

# 3. Artisan backend security & upload tests
node --import tsx --test apps/artisan/lib/backend.test.ts

# 4. Full production build verification
npm run build
```
