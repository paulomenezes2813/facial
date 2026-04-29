/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@facial/shared'],
  // 'standalone' empacota só o necessário pra deploy em container (Railway, etc.)
  output: 'standalone',
  // Em monorepo, ajuda o Next a encontrar o root do workspace
  outputFileTracingRoot: process.cwd().includes('apps/web')
    ? new URL('../../', import.meta.url).pathname
    : undefined,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
