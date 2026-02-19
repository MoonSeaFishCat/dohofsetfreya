/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // dns-packet 是 ESM-only 包，需要让 Next.js 转译它才能在 API Routes 中使用
  transpilePackages: ['dns-packet'],
}

export default nextConfig
