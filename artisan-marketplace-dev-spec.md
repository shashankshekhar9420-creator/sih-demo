# AI-Driven Market Linkage and Smart Cataloging for Marginalized Artisans
## Development Specification (Hackathon Prototype)

Status: Locked for development. This document is the single source of truth. Where anything here conflicts with earlier notes or the teammate's research doc, THIS document wins.

---

## 1. What This Is

A laptop demo of two connected web applications, built to demonstrate the mobile-app concept described in the official problem statement ("AI-Driven Market Linkage and Smart Cataloging Mobile Application for Marginalized Artisans"). This prototype is deliberately web-based, running on one laptop, in front of judges. It is not a production system and does not need production auth, payments, cloud storage, real-time infrastructure, or deployment infrastructure.

Two apps:
1. **Artisan Studio App** — where the artisan photographs a product, describes it by voice, and publishes it.
2. **E-commerce Marketplace Clone** — a buyer-facing storefront plus a seller dashboard, showing published products.

---

## 2. Tech Stack (decided)

- **Framework:** Next.js (App Router), one project per app
- **Database:** SQLite, via Prisma ORM — two separate database files, one per app
- **Validation:** Zod on every mutation and every API boundary
- **Auth:** No real auth. Seller side uses a single hardcoded demo account + HTTP-only session cookie (see §9)
- **File storage:** Local filesystem only, under each app's own public directory
- **Styling:** Editorial, warm-neutral, low-digital-literacy-friendly (see §4)

No cloud services, no external DB, no third-party auth providers.

---

## 3. Ports and Apps

| App | Port | URL |
|---|---|---|
| Commerce app (buyer + seller) | 3000 | http://localhost:3000 |
| Artisan Studio app | 4000 | http://localhost:4000 |

---

## 4. Visual/UX Direction

- Clean, intentional, accessible, low-digital-literacy-friendly throughout both apps.
- **Commerce marketplace:** editorial handicraft marketplace style — warm neutral background, strong product imagery, clear product cards, elegant typography, simple category navigation, prominent prices, clear "Buy Now" action. Seller dashboard stays practical and data-oriented (tables, numbers, not editorial).
- **Artisan Studio:** a visible, linear, step-by-step wizard. One task per screen. Large tap targets. Minimal text per screen. Voice-first wherever a written form would otherwise be required.

---

## 5. Product Scope

### Implement
- Product catalog browsing, search, category filter, sort (newest / price asc / price desc)
- Product detail pages
- Direct "Buy Now" flow (no cart)
- Dummy order creation, immediately marked PAID
- Seller dashboard, product management, order management
- Artisan image capture + (stubbed) AI enhancement
- Voice recording + (stubbed) transcription/translation
- (Stubbed) AI-generated catalog content
- (Stubbed) AI pricing recommendation
- Catalog review and editing
- One-click publish from artisan app → commerce app
- Published product appears immediately on the commerce app
- Orders visible in the artisan dashboard (pulled from commerce app)

### Do NOT implement
- Shopping cart
- Real payment processing
- Real user registration / password reset / email notifications
- Real production authentication or social login
- Complex role management
- Cloud file uploads
- Live market scraping (pricing is a stub — see §8)
- Multi-vendor onboarding
- Real shipping/fulfillment integration
- Product variants (color/size) — one product = one listing, no separate variant stock/price
- Brand, SKU/model ID, MOQ, legal/compliance fields (GST, certifications, importer, country of origin), warranty/return policy fields — none of this applies to a solo-artisan handmade-goods demo and it is explicitly out of scope

---

## 6. Artisan Studio — User Flow

Single hardcoded artisan/seller (`seller-demo`). No onboarding/profile step — artisan details are hardcoded in env/config, not collected in-app.

Per-listing flow, in order:

1. **Create catalog** — starts a new `Catalog` record in DRAFT status.
2. **Upload three product images** — main angle, detail/side, close-up/texture. File picker + drag-and-drop. Accepts JPG/JPEG/PNG. Validate file type, file size (max 10MB/image recommended), and exactly 3 images before moving on.
3. **Enhance images (black box)** — send the 3 raw images to the image-enhancement endpoint. See §8 for contract and stub behavior.
4. **Record voice description** — exactly 3 recordings, one per question below. Each recording uses `MediaRecorder` in-browser, with a file-upload fallback. Supported formats: `audio/webm`, `audio/wav`, `audio/mpeg`, `audio/mp4`, `audio/ogg`.

   **The 3 questions (asked in Hindi in the UI, answered by voice):**
   - **Q1 — Basics:** "इस उत्पाद का नाम क्या है, और यह किस चीज़ से बना है?" ("What is this product called, and what material is it made from?")
   - **Q2 — Features & appearance:** "यह कैसे बनाया गया है, और यह देखने में कैसा है — आकार, रंग, वज़न, और कोई खास डिज़ाइन?" ("How is it made, and what does it look like — size, color, weight, and any special pattern or design?")
   - **Q3 — Use & story:** "इसका उपयोग किस लिए होता है, और क्या इसके पीछे कोई कहानी, परंपरा, या त्योहार जुड़ा है?" ("What is it used for, and is there a story, tradition, or festival connection behind it?")

5. **Transcribe and translate voice (black box)** — each of the 3 recordings is sent independently for transcription + translation. See §8.
6. **Select category** — flat dropdown, artisan taps one (AI may also suggest one from the transcripts, shown as a pre-selected default the artisan can change). See §7 for the category list.
7. **Generate catalog (black box)** — the 3 (translated) transcripts + processed images + category are sent to the catalog-generation endpoint, which returns structured catalog fields (title, description, bullets, specifics, keywords, Hindi variants of the text fields). See §8.
8. **Enter cost + calculate pricing (black box)** — artisan enters "how much does it cost you to make one" (number, typed or read aloud and transcribed). This is sent to the pricing endpoint along with category/description, which returns a recommended price. See §8.
9. **Enter stock** — numeric stepper, how many are ready now. Plain form field, not voice, not a black box.
10. **Review and edit** — single screen showing everything (see §6a below). Every field is editable.
11. **Publish to marketplace** — one button. Calls the artisan app's own publish endpoint, which calls the commerce app's publish endpoint server-to-server. See §9.
12. **View published listing** — after publish succeeds, show a confirmation with a link to the live product page on the commerce app (port 3000).

If publish fails: catalog stays editable, status is set to FAILED, a short error message is stored and shown, and a retry option is offered.

### 6a. Catalog Review Screen — required fields
- Raw image thumbnails (3)
- Processed image thumbnails (3)
- Title / Hindi title
- Category
- English description / Hindi description
- English bullets / Hindi bullets
- Product specifics (structured: material, size, color, weight — whatever was extracted)
- Keywords
- Recommended price / final editable price
- Stock

---

## 7. Categories (flat list, locked)

Used both as the artisan-side category picker and the commerce-side filter. No category-specific branching logic anywhere in the app — this list is purely a label used for browsing/filtering.

1. Pottery & Terracotta
2. Handloom & Weaving
3. Embroidery & Textile Art
4. Wood Carving & Woodwork
5. Metal & Brass Craft
6. Jewelry & Beadwork
7. Bamboo & Cane Craft
8. Stone & Marble Craft
9. Folk Painting & Art
10. Leather Craft
11. Other

---

## 8. Black Box Endpoints — Contracts and Stub Behavior

For every black box below: **the route, request schema, and response schema are fixed and real, and must be built now.** What sits behind the route can be the simplest deterministic implementation that returns a validly-shaped response. Nothing else in the app should need to change when a real model is dropped in later — only the internals of these route handlers change.

### 8.1 Image Enhancement
`POST /api/catalogs/{id}/process-images`
- Input: the 3 raw image paths/files for the catalog.
- Output: 3 processed image paths + updated catalog status.
- Real-model intent (for later): remove background, apply pure white/light-neutral studio background, even studio lighting, subtle contact shadow, preserve product exactly (shape, color, pattern, texture, orientation) — no redesigning or inventing detail. Return one edited image per input, no explanatory text.
- **Stub now:** copy the raw image to the "processed" path unchanged (optionally apply a trivial visual treatment), after a short artificial delay, and return those paths in the same response shape a real model would return.

### 8.2 Voice Transcription + Translation
`POST /api/catalogs/{id}/transcribe`
- Input: 3 audio files (one per question), each tagged by question number.
- Output: for each, detected source language, transcript in original script, English translation.
- Real-model intent (for later): detect spoken language, transcribe in original script, translate naturally to English, preserve artisan-provided facts, never invent measurements/certifications/materials/features not stated.
- **Stub now:** return a fixed placeholder transcript + English translation per question number, in the same response shape.

### 8.3 Catalog Generation
`POST /api/catalogs/{id}/generate`
- Input: 3 English translations (from §8.2), 3 processed image paths, selected category.
- Output: title, Hindi title, description, Hindi description, bullets, Hindi bullets, product specifics (object), keywords (array).
- **Stub now:** deterministically template these fields from the input transcripts and category (plain string concatenation/templating) — no real generation model. Response shape must match what a real model would return.

### 8.4 Pricing
`POST /api/catalogs/{id}/price`
- Input: material cost (artisan-entered number), category, description/keywords.
- Output: recommended price.
- Real-model intent (for later): informed by market-price web scraping.
- **Stub now:** simple formula off the entered cost (e.g. `cost × fixed markup multiplier`) — no real scraping. Response shape must match what a real model would return.

Every black-box route must: check the catalog exists, prevent invalid state transitions, return structured JSON, catch and log errors safely, never expose stack traces or API keys, and persist results before returning success.

---

## 9. Integration Between Apps

Server-to-server only. The artisan app's backend calls the commerce app's backend directly; the API key is never sent from browser JavaScript.

```env
DEMO_API_KEY=local-demo-key
COMMERCE_APP_URL=http://localhost:3000
ARTISAN_APP_URL=http://localhost:4000
```

Every artisan→commerce request includes:
```
x-demo-api-key: local-demo-key
Content-Type: application/json
```

### Commerce: Publish endpoint
`POST /api/artisan/catalogs/publish`
- Validates API key and request body (Zod).
- Creates a new `Product` if `artisanCatalogId` is not yet linked to one; updates the existing one if it is (idempotent — no duplicate listings).
- Generates a stable unique slug.
- Returns `{ listingId, productUrl, created }`.
- Revalidates the commerce product listing pages so the new/updated product shows immediately.

Request body:
```json
{
  "artisanCatalogId": "string",
  "sellerId": "seller-demo",
  "title": "string",
  "hindiTitle": "string",
  "category": "string",
  "description": "string",
  "hindiDescription": "string",
  "bullets": ["string"],
  "hindiBullets": ["string"],
  "specifics": {},
  "keywords": ["string"],
  "images": ["string"],
  "price": 0,
  "stock": 1
}
```

### Commerce: Update endpoint
`PUT /api/artisan/catalogs/update` — same validation and idempotent behavior as publish.

### Commerce: Orders-for-artisan endpoint
`GET /api/artisan/orders?sellerId=seller-demo`
- Validates API key, returns orders for the requested seller, includes product title + image, sorted newest first.
- Called server-side by the artisan app and shown in the artisan dashboard.

### Artisan: Publish trigger endpoint
`POST /api/catalogs/{catalogId}/publish`
- Loads the catalog, validates it's publishable, builds the commerce payload, converts local image paths to full URLs via `ARTISAN_APP_URL`, calls the commerce publish endpoint, saves `commerceListingId` + `productUrl`, sets status to PUBLISHED, returns the product URL.
- On failure: catalog stays editable, status → FAILED, short error message stored, retry offered.

---

## 10. Commerce Marketplace — Buyer Side

### Home page
Product grid, search input, category filter, sort (Newest / Price low→high / Price high→low). Each card: image, title, category, price, stock indicator, seller name, link to product detail.

### Product detail page
Image gallery, title, seller, price, stock, description, bullets, product specifics, keywords/related category, Hindi content toggle (shown only if Hindi content exists on that product), "Buy Now" button. No cart.

### Buy Now form
Collects: name, email, address, quantity (default 1). On submit:
1. Validate server-side
2. Re-read the current product from the DB
3. Verify product is published
4. Verify sufficient stock
5. Calculate total server-side
6. Create the order
7. Set order status to PAID immediately
8. Decrease product stock
9. Redirect to order confirmation page

No real payment processing.

### Order confirmation page
Order ID, product, quantity, total, buyer name, delivery address, status (PAID), link back to marketplace.

---

## 11. Commerce Marketplace — Seller Side

### Login
Single hardcoded account via env vars:
```env
DEMO_SELLER_ID=seller-demo
DEMO_SELLER_EMAIL=demo@sahaj-market.test
DEMO_SELLER_PASSWORD=demo123
```
Not production auth. On success: set a simple HTTP-only demo session cookie, redirect to `/seller/dashboard`. All seller pages check this cookie. Logout action clears it.

### Seller dashboard
Total revenue, active listings, units sold, pending orders, low-stock products, recent orders, recent products, links to manage products / manage orders.

### Seller products page
Table/list: image, title, category, price, stock, published status, origin indicator (Seed product vs Artisan app). Seller can edit price, stock, and published/hidden status.

### Seller orders page
List/manage orders for this seller.

---

## 12. Database Design

Two separate SQLite databases (Prisma), one per app. Do not rely on Prisma `Json` fields if the SQLite/Prisma version doesn't support them reliably — store structured arrays/objects as validated JSON strings with helper functions for serialize/parse.

### 12.1 Artisan DB

```prisma
model Catalog {
  id                   String        @id @default(cuid())
  sellerId             String        @default("seller-demo")
  status               CatalogStatus @default(DRAFT)
  processingStep       String?

  rawImagesJson        String        @default("[]")
  processedImagesJson  String        @default("[]")

  audioPathsJson       String        @default("[]")   // 3 entries, one per question
  audioMimeType        String?

  sourceLanguage       String?
  regionalTranscriptsJson String     @default("[]")   // 3 entries
  englishTranslationsJson String     @default("[]")   // 3 entries

  title                String?
  hindiTitle           String?
  category             String?
  bulletsJson          String        @default("[]")
  hindiBulletsJson     String        @default("[]")
  description          String?
  hindiDescription     String?
  specificsJson        String        @default("{}")
  keywordsJson         String        @default("[]")

  materialCost         Float?
  recommendedPrice     Float?
  finalPrice           Float?
  stock                Int           @default(1)

  commerceListingId    String?
  productUrl           String?
  errorMessage         String?

  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt
}

enum CatalogStatus {
  DRAFT
  PROCESSING
  READY
  PUBLISHED
  FAILED
}
```

(Field names may be adjusted during implementation, but this shape and these behaviors must be retained. Note this is simplified from an earlier draft: no per-question single fields — the 3 voice Q&A pairs are stored as JSON arrays indexed 0-2, matching Q1/Q2/Q3 in §6. No pricing-formula breakdown fields (hours/laborRate/marketMin/marketMax) — the pricing stub only needs `materialCost` in and `recommendedPrice` out; add breakdown fields later only if the real pricing model needs to persist them.)

### 12.2 Commerce DB

```prisma
model Seller {
  id        String    @id
  name      String
  email     String?
  products  Product[]
  orders    Order[]
  createdAt DateTime  @default(now())
}

model Product {
  id               String   @id @default(cuid())
  sellerId         String
  artisanCatalogId String?  @unique

  title            String
  hindiTitle       String?
  slug             String   @unique
  category         String
  description      String
  hindiDescription String?
  bulletsJson      String   @default("[]")
  hindiBulletsJson String   @default("[]")
  imagesJson       String   @default("[]")
  specificsJson    String   @default("{}")
  keywordsJson     String   @default("[]")

  price            Float
  stock            Int      @default(1)
  isPublished      Boolean  @default(true)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  seller           Seller   @relation(fields: [sellerId], references: [id])
  orders           Order[]

  @@index([category])
  @@index([isPublished])
  @@index([createdAt])
}

model Order {
  id          String      @id @default(cuid())
  productId   String
  sellerId    String
  buyerName   String
  buyerEmail  String
  address     String
  quantity    Int         @default(1)
  total       Float
  status      OrderStatus @default(PAID)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  product     Product     @relation(fields: [productId], references: [id])
  seller      Seller      @relation(fields: [sellerId], references: [id])

  @@index([sellerId])
  @@index([status])
}

enum OrderStatus {
  PAID
  DISPATCHED
  DELIVERED
}
```

### 12.3 Seed Data

Seeding must be safe to re-run (idempotent — no duplicate rows, no broken relations on repeat runs) since it should also serve as a manual safety net: if seed data ever looks wrong before a demo, it can be re-run or hand-edited directly without breaking the app.

Minimum seed content:
- At least 3 sellers, one of which has `id = "seller-demo"` (matches the hardcoded login)
- At least 8 products, spread across multiple categories from §7, with varied prices and stock levels
- A few example orders, with at least one against `seller-demo`
- Local SVG or static image assets for seed product images (no external image URLs)

Suggested seed products: handwoven cotton saree, bamboo basket, terracotta vase, embroidered cushion cover, brass diya set, hand-painted wooden tray, beaded earrings, woven wall hanging. Realistic but clearly demo-oriented data (no real prices claimed as market-accurate).

The marketplace must look populated before the artisan app publishes anything.

---

## 13. Artisan API Routes

```
POST  /api/catalogs
GET   /api/catalogs
GET   /api/catalogs/[id]
POST  /api/catalogs/[id]/process-images
POST  /api/catalogs/[id]/transcribe
POST  /api/catalogs/[id]/generate
POST  /api/catalogs/[id]/price
PATCH /api/catalogs/[id]
POST  /api/catalogs/[id]/publish
GET   /api/dashboard
```

The multipart image-creation route (`POST /api/catalogs`, or a dedicated image upload route) must accept exactly 3 images, validate type/size, create the catalog ID, save raw images, and return the catalog ID + image metadata.

Every processing route must: check the catalog exists, prevent invalid state transitions, return structured JSON, catch/log errors safely without exposing internals, and persist results before returning success.

---

## 14. Commerce API Routes

```
GET   /api/products
GET   /api/products/[slug]
POST  /api/products/[id]/orders
GET   /api/seller/dashboard
GET   /api/seller/products
PATCH /api/seller/products/[id]
GET   /api/seller/orders
PATCH /api/seller/orders/[id]
POST  /api/artisan/catalogs/publish
PUT   /api/artisan/catalogs/update
GET   /api/artisan/orders
```

Server-side validation on every mutation. Consistent error shape:
```json
{ "error": "Human-readable message", "code": "VALIDATION_ERROR" }
```

Status codes: `400` invalid input · `401` invalid demo API key or missing seller session · `404` missing record · `409` stock or duplicate conflict · `500` unexpected server error.

---

## 15. Explicit Design Decisions (for reference — do not relitigate these during build)

- Web apps on one laptop, not native mobile — a deliberate prototype of the mobile-app vision, not a deviation from it.
- No artisan onboarding/profile step. Artisan identity is hardcoded (`seller-demo`).
- Exactly 3 voice recordings per catalog, one per fixed question (§6, step 4). No open-ended single recording, no 5+ question form.
- Flat, non-branching category list (§7). No category-specific safety/SEO tap-questions.
- No product variants. One product = one listing, one price, one stock count.
- Black-box endpoints are real contracts with stubbed (deterministic, non-AI) implementations for now (§8). Only the internals of those route handlers should need to change when real models are integrated later.
- Tech stack: Next.js (App Router) + Prisma + SQLite + Zod, for both apps.
- Seed data must be idempotent and safe to re-run or hand-edit before a demo.
