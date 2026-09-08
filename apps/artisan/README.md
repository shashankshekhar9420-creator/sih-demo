# Sahaj Artisan Studio (@sahaj/artisan)

The **Artisan Studio** is a voice-first, accessible, step-by-step smart cataloging application designed for marginalized craftspeople and artisans with low digital literacy.

Built with Next.js 15 App Router, React 19, Prisma 6.19 (SQLite), Zod 3, and Lucide icons.

---

## Key Features

1. **Voice-First Cataloging**:
   - Asks artisans 3 simple craft questions in Hindi.
   - In-browser voice recording using `MediaRecorder` with file-upload fallback (`audio/webm`, `audio/wav`, `audio/ogg`).
   - Placeholder audio transcription and translation stub.
2. **3-Photo Product Capture**:
   - Enforces exactly 3 product photographs (Primary angle, Detail/side, Close-up texture).
   - Drag-and-drop, camera file-picker, and client-side preview.
   - Server-side image signature and MIME validation (PNG/JPEG/WebP up to 10MB).
3. **Smart Bilingual Catalog Generation**:
   - Generates polished English and Hindi titles, descriptions, feature bullet points, and craft specifics.
4. **Fair Pricing Calculator**:
   - Recommends fair market pricing (`materialCost × 2`) to eliminate artisan undervaluation.
5. **One-Click Publishing**:
   - Publishes directly to the Sahaj Commerce marketplace via an authenticated server-to-server API call.
   - Idempotent: republishing updates the existing catalog without creating duplicate listings.
6. **Unified Orders & Status**:
   - Queries Commerce backend to show live customer orders and fulfillment statuses directly to the artisan.

---

## Local Development

From the repository root or from `apps/artisan`:

```bash
# Setup database and Prisma client
npm run db:setup -w @sahaj/artisan

# Start development server on port 4000
npm run dev -w @sahaj/artisan
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs Next.js development server on port `4000` |
| `npm run build` | Compiles production Next.js application |
| `npm run start` | Runs production server on port `4000` |
| `npm run db:setup` | Runs `prisma generate` and `prisma db push` |
| `npm run test` | Runs backend API, validation, and upload tests |
| `npm run typecheck` | Typechecks with TypeScript (`tsc --noEmit`) |

---

## API Routes Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/catalogs` | `GET`, `POST` | List catalogs or create a new catalog draft |
| `/api/catalogs/[id]` | `GET`, `PATCH` | Fetch or update catalog metadata |
| `/api/catalogs/[id]/images` | `POST` | Upload exactly 3 raw product images |
| `/api/catalogs/[id]/process-images`| `POST` | Trigger image processing stub |
| `/api/catalogs/[id]/transcribe` | `POST` | Upload and transcribe 3 audio answers |
| `/api/catalogs/[id]/generate` | `POST` | Generate bilingual catalog fields |
| `/api/catalogs/[id]/price` | `POST` | Calculate pricing recommendations |
| `/api/catalogs/[id]/publish` | `POST` | Publish catalog to Commerce marketplace |
| `/api/dashboard` | `GET` | Aggregated catalog counts and commerce orders |
| `/uploads/[...path]` | `GET` | Serves uploaded product images |
