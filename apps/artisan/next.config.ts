import type { NextConfig } from 'next';
const config: NextConfig = {transpilePackages: ['@sahaj/shared'], devIndicators: false, eslint: { ignoreDuringBuilds: true }};
export default config;
