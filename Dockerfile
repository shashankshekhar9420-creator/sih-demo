FROM node:22-alpine AS base

# Install OpenSSL & libc6-compat for Prisma on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy root package manifests and package-lock
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/commerce/package.json ./apps/commerce/
COPY apps/artisan/package.json ./apps/artisan/

# Install all workspace dependencies
RUN npm install

# Copy complete source tree
COPY . .

# Generate custom Prisma clients and run migrations
RUN npm run db:setup

# Build production assets for both applications
RUN npm run build

# Default environment settings
ENV NODE_ENV=production
ENV COMMERCE_APP_URL=http://localhost:3000
ENV ARTISAN_APP_URL=http://localhost:4000
ENV DEMO_API_KEY=local-demo-key

# Expose both web app ports
EXPOSE 3000 4000

# Start both services concurrently
CMD ["npm", "start"]
