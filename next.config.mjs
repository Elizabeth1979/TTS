/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Skip ESLint during builds (run separately in CI/local)
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: true,
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    }
  }
};

export default nextConfig;
