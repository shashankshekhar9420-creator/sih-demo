import 'server-only';

export const config = {
  apiKey: process.env.DEMO_API_KEY || 'local-demo-key',
  sellerId: process.env.DEMO_SELLER_ID || 'seller-demo',
  sellerEmail: process.env.DEMO_SELLER_EMAIL || 'demo@sahaj-market.test',
  sellerPassword: process.env.DEMO_SELLER_PASSWORD || 'demo123',
  sessionSecret: process.env.DEMO_SESSION_SECRET || 'sahaj-local-only-change-before-deployment-2026',
  commerceUrl: process.env.COMMERCE_APP_URL || 'http://localhost:3000',
  artisanUrl: process.env.ARTISAN_APP_URL || 'http://localhost:4000',
};
