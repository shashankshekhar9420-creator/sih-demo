import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@imgly/background-removal-node', 'onnxruntime-node', 'sharp'],
  transpilePackages: ['@sahaj/shared'],
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
};

export default config;
