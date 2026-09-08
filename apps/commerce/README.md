# Sahaj Commerce

A local, fully functional handmade marketplace and seller workspace. Next.js 15 App Router, React 19, Prisma 6.19, SQLite, Zod 3, and lucide-react. All commerce-owned files, static artwork, generated client, and database stay in this app.

## Run

After the workspace dependencies have been installed by the project owner, run these from `apps/commerce`:

```sh
npm run db:setup
npm run seed
npm run dev
```

Open `http://localhost:3000`. For a production-mode local demo: `npm run build`, then `npm start`. Database setup must precede build so the custom Prisma client exists.

No `.env` is required. `prisma/schema.prisma` uses `file:./commerce.db` (resolved to `prisma/commerce.db`); the Prisma generator outputs to `generated/client`. `.env.example` documents optional server-only overrides. Never expose any credential through a `NEXT_PUBLIC_` variable.

Demo login at `/seller/login`: `demo@sahaj-market.test` / `demo123`. The seller is `seller-demo`. The shared publish contract intentionally fixes the integration seller to `seller-demo`; keep `DEMO_SELLER_ID` at that default when demonstrating the connected apps.

## Pages

- `/`: editorial storefront, search, all eleven categories, newest/price sort, local artwork, maker stories, empty results.
- `/products/[slug]`: image gallery, optional Hindi toggle, price, stock, bullets, specifics, keywords and related pieces.
- `/products/[slug]/buy`: direct checkout with buyer details and quantity. No cart or payment provider.
- `/orders/[id]?token=...`: private order receipt, current status and delivery details. Missing or invalid tokens return 404; receipt pages are noindex and send no referrer.
- `/seller/login`: demo login. The password is never embedded in client code or prefilled.
- `/seller/dashboard`, `/seller/products`, `/seller/orders`: protected in the shared layout **and each page**, including all seller API routes. Logout clears the signed, HTTP-only, SameSite=Lax, eight-hour cookie.

## API Contract

Every API error is `{ "error": "Human-readable message", "code": "MACHINE_CODE" }`. Statuses: 400 invalid input, 401 unauthorized, 404 unavailable record, 409 stock/status/concurrency conflict, 500 safe unexpected error. Successful API responses use `Cache-Control: no-store`. Mutation bodies are strict Zod objects. JSON parse errors are caught; no stack traces, keys or database messages are returned.

| Route | Request / response |
| --- | --- |
| `GET /api/products` | Query: `search`, `category` (exact shared label), `sort=newest\|price-asc\|price-desc`. Omit category for all. Defaults: empty search, newest. Unknown query keys/invalid values return 400. Returns `{ products: ProductView[] }`. No aliases. |
| `GET /api/products/[slug]` | Published listing only; `{ product: ProductView }`, otherwise 404. |
| `POST /api/products/[id]/orders` | `{ buyerName, buyerEmail, address, quantity? }`, quantity defaults to 1. Returns 201 `{ order: { id, productId, quantity, total, status: "PAID" }, confirmationUrl }`. The URL includes a private random receipt token. The folder is `[slug]/orders` because Next.js requires one dynamic-segment name at this level, but this route's segment **accepts the product ID**, not slug. |
| `POST /api/seller/login` | `{ email, password }`; sets signed cookie, returns `{ redirectUrl: "/seller/dashboard" }`. |
| `POST /api/seller/logout` | Clears cookie, returns `{ redirectUrl: "/seller/login" }`. |
| `GET /api/seller/dashboard` | `{ totalRevenue, activeListings, unitsSold, pendingOrders, lowStockProducts, recentOrders, recentProducts }`; low stock means published stock <= 3; pending means PAID. |
| `GET /api/seller/products` | `{ products: ProductView[] }`, including hidden listings, scoped to session seller. |
| `PATCH /api/seller/products/[id]` | Nonempty subset of `{ price, stock, isPublished }`; returns `{ product: ProductView }`. Absolute stock replacement. Foreign seller IDs return 404. |
| `GET /api/seller/orders` | `{ orders: ArtisanOrder[] }`, seller-scoped, newest first. |
| `PATCH /api/seller/orders/[id]` | `{ status: "PAID"\|"DISPATCHED"\|"DELIVERED" }`; same status is idempotent, otherwise only the next status is allowed. Returns `{ order: { id, status } }`. |
| `POST /api/artisan/catalogs/publish` | Shared `publishSchema`; returns exactly `{ listingId, productUrl, created }` using `publishResultSchema`. |
| `PUT /api/artisan/catalogs/update` | Same body and create-or-update behavior as publish. |
| `GET /api/artisan/orders?sellerId=seller-demo` | Returns exactly the shared `artisanOrdersResponseSchema`, newest first. Other seller IDs are rejected by the fixed demo integration boundary. |

`ProductView` contains normal product scalar fields with ISO dates, plus parsed `images`, `bullets`, `hindiBullets`, `specifics`, `keywords`, and `seller: { id, name, location, story }`. It does not expose serialized JSON fields or seller email.

The artisan order response is **exactly**:

```ts
{
  orders: Array<{
    id: string; productId: string; sellerId: string;
    buyerName: string; buyerEmail: string; address: string;
    quantity: number; total: number;
    status: 'PAID' | 'DISPATCHED' | 'DELIVERED';
    createdAt: string; updatedAt: string;
    product: { title: string; images: string[]; slug: string };
  }>;
}
```

Artisan routes require `x-demo-api-key`, default `local-demo-key`. Integration calls must be server-to-server. Exactly three full HTTP(S) image URLs are required; each must match the origin of `ARTISAN_APP_URL` (default `http://localhost:4000`) and cannot contain URL credentials. Commerce never fetches or proxies arbitrary remote files. The browser displays approved Artisan Studio image URLs directly; Studio must be running to display those uploads. Seed artwork is served locally from `/art/*.svg`, with no network/font dependency. No commerce uploads route is needed.

## Integrity

- Buy Now rereads the published product in a SQLite transaction, conditionally decrements sufficient stock, calculates totals server-side using integer paise, and creates the PAID order in the same transaction. An order failure rolls back stock. Concurrent stock/database conflicts return a safe 409 to retry; stock cannot go negative.
- `artisanCatalogId` is unique. Publish/update upsert by this key, retain the listing ID and original slug, and revalidate storefront, product and seller views. The first slug combines a readable title and a catalog-ID hash. A different title on retry does not change the URL.
- Republish intentionally applies the supplied absolute price and stock and makes the listing visible, per the publish/update spec. It is listing-identity idempotency, not a stock-delta protocol. Coordinate inventory in the Studio before republishing after sales.
- Seller mutations verify session ownership and reject cross-origin browser requests. Session cookies contain only a signed seller ID and expiry, never the login password or API key. Defaults are for a single-laptop demo, not production security; use HTTPS and new secrets before any deployment.
- Receipt tokens are excluded from every seller/artisan list response. All data-backed buyer pages are force-dynamic. Seller pages also recheck session per request.

## Seed And Checks

`prisma/seed.ts` inserts three sellers, eight products in seven categories, and four example orders in one transaction. All nine original SVG illustrations live in `public/art`. Seed IDs are fixed and upserts update nothing: rerunning fills missing rows without resetting edits, current stock, order progress, or published artisan listings. Seed stock is **already remaining inventory** after the historical example orders; seeding does not decrement it again. Seed prices and buyer identities are fictional.

```sh
npm run typecheck
npm run build
# Dependency-free structure and SVG checks:
node --test tests/static.test.mjs
# With the local server running after db:setup + seed:
npm test
```

`tests/commerce.test.ts` exercises public filtering, authentication, signed cookies, ownership, hidden products, strict validation, publish retry identity, allowed image origins, concurrent checkout, private receipts, exact shared orders response, order status transitions and logout. It creates uniquely named test listings and deletes only those test records afterward. Use the default demo seller and seeded sellers for this suite.

Checkout submission disables its button while in flight; network retries are separate purchases, not a payment-idempotency protocol. This local demo has no rate limiting, real payments, real shipping, registration, cart, or cloud storage.
