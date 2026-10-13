import type { NextConfig } from 'next';
import { IMAGE_HOSTS } from './src/lib/image-hosts';

const nextConfig: NextConfig = {
  images: {
    // next/image does not re-check remotePatterns on redirects; an open redirect on an allowed host would bypass the list.
    maximumRedirects: 0,
    // Recipe photos are hotlinked from the source sites (recipes.image_url); only these hosts.
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: 'https' as const, hostname })),
  },
};

export default nextConfig;
