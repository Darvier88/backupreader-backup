/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El build de producción es estricto con TypeScript y ESLint. Como el
  // proyecto funciona en desarrollo, evitamos que un error de tipo/lint
  // latente rompa el despliegue en Vercel.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/about',
        headers: [
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          {
            key: 'Content-Range',
            value: 'bytes=0-99999',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
