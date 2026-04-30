/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@facial/shared'],
  // 'standalone' empacota só o necessário pra deploy em container (Railway, etc.)
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
