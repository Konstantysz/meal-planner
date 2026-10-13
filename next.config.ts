import type { NextConfig } from 'next';
import { IMAGE_HOSTS } from './src/lib/image-hosts';

const nextConfig: NextConfig = {
  images: {
    // Recipe photos are hotlinked from the source sites (recipes.image_url); only these hosts.
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: 'https' as const, hostname })),
  },
};

export default nextConfig;
