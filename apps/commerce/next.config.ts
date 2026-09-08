import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@sahaj/shared'],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/Application Data/**', '**/AppData/**', '**/Cookies/**', '**/Local Settings/**'],
    };
    return config;
  },
};
export default config;
