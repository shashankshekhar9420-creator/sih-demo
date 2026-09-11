# Sahaj (सहज) — Artisan Marketplace & AI Cataloging

A voice-first cataloging studio for rural artisans paired with an e-commerce handicraft marketplace.

> 💡 **Giving a live presentation or evaluation?** Follow the **[Demo Presentation Guide (DEMO_GUIDE.md)](file:///d:/sih-demo/DEMO_GUIDE.md)** for a 4-act script, demo credentials, sample files, and live GPU talking points.

---

## ⚡ Quick Start: How to Run

### 1. Prerequisites
- **Node.js**: v20 or higher
- **npm**: v9 or higher
- **Python**: 3.10+ (optional, for local AI processors)

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Databases & Seed Data
```bash
npm run db:setup
npm run seed
```

### 4. Start Development Servers
```bash
npm run dev
```

Open your browser:
- 🎨 **Artisan Studio**: [http://localhost:4000](http://localhost:4000)
- 🛒 **Commerce Marketplace**: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Demo Login & Credentials

- **Seller Login**: [http://localhost:3000/seller/login](http://localhost:3000/seller/login)
  - **Email**: `demo@sahaj-market.test`
  - **Password**: `demo123`
- **Demo Seller ID**: `seller-demo`
- **Internal API Key**: `local-demo-key`

---

## 🧭 How to Test the Demo Flow

1. **Create a Catalog (Artisan Studio — `:4000`)**:
   - Go to [http://localhost:4000/catalogs/new](http://localhost:4000/catalogs/new).
   - Upload 3 photos (main view, detail, texture).
   - Record or upload 3 voice answers in Hindi.
   - Choose a craft category and click **Generate my catalog**.
   - Set making cost, review the bilingual draft, and click **Publish to Commerce**.

2. **Buy as a Customer (Marketplace — `:3000`)**:
   - View your published product on [http://localhost:3000](http://localhost:3000).
   - Click **Buy Now** to place an order and see inventory update.

3. **Manage Orders (Seller Dashboard — `:3000/seller/dashboard`)**:
   - Log in to view sales, update order fulfillment, and see live sync back in Artisan Studio.

---

## 🤖 AI Engines & Local GPU Acceleration (Optional)

All AI processing (background removal, speech transcription, catalog generation) includes automatic deterministic fallbacks so the app runs smoothly out-of-the-box without external dependencies.

### Running the LLM locally on GPU (RTX 3050 / CUDA)
1. Install [Ollama](https://ollama.com/) (bundled with NVIDIA CUDA acceleration for Windows).
2. Pull the default 7B model (~4.1 GB, fits completely in 6 GB VRAM):
   ```bash
   ollama pull mistral:7b-instruct-q4_K_M
   ollama serve
   ```
3. The app is pre-configured (`OLLAMA_NUM_GPU=99`, `OLLAMA_MAIN_GPU=0`) to offload **100% of model layers directly to your dedicated NVIDIA GPU**.
4. To verify GPU offloading while running:
   ```bash
   ollama ps       # Shows 100% GPU / size in VRAM
   nvidia-smi      # Shows active VRAM usage (~4.1 GB) on GPU 0
   ```

---

## 🧪 Run Tests

```bash
# Shared contract tests
npm test

# Artisan backend & AI catalog generation tests
npm test --prefix apps/artisan

# Python AI catalog generator tests
python scripts/test_generate_processor.py
```
