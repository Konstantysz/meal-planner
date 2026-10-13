import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractImageUrl } from '@/lib/import/image';
import { isAllowedImageUrl } from '@/lib/image-hosts';

const PAGE = 'https://aniagotuje.pl/przepis/x';
const ld = (json: unknown) => `<script type="application/ld+json">${JSON.stringify(json)}</script>`;
const og = (url: string) => `<meta property="og:image" content="${url}">`;

describe('extractImageUrl', () => {
  it('reads og:image from the aniagotuje fixture', () => {
    const html = readFileSync('tests/fixtures/aniagotuje/sample.html', 'utf8');
    expect(extractImageUrl(html, PAGE)).toBe(
      'https://cdn.aniagotuje.com/pictures/articles/2021/10/20290189-v-1500x1500.jpg',
    );
  });

  it('reads og:image from the jadlonomia fixture', () => {
    const html = readFileSync('tests/fixtures/jadlonomia/sample.html', 'utf8');
    expect(extractImageUrl(html, 'https://jadlonomia.com/przepisy/x')).toBe(
      'https://jadlonomia.com/wp-content/uploads/2018/09/IMG_9593_duze-1444x443.jpg',
    );
  });

  it('prefers the JSON-LD Recipe image over og:image', () => {
    const html =
      ld({ '@type': 'Recipe', image: ['https://cdn.aniagotuje.com/a.jpg'] }) + og('https://cdn.aniagotuje.com/b.jpg');
    expect(extractImageUrl(html, PAGE)).toBe('https://cdn.aniagotuje.com/a.jpg');
  });

  it('finds a Recipe inside @graph and an ImageObject url', () => {
    const html = ld({
      '@graph': [
        { '@type': 'WebSite' },
        { '@type': ['Thing', 'Recipe'], image: { '@type': 'ImageObject', url: 'https://jadlonomia.com/c.jpg' } },
      ],
    });
    expect(extractImageUrl(html, 'https://jadlonomia.com/x')).toBe('https://jadlonomia.com/c.jpg');
  });

  it('resolves a relative URL against the page', () => {
    expect(extractImageUrl(og('/pictures/d.jpg'), 'https://www.aniagotuje.pl/przepis/x')).toBe(
      'https://www.aniagotuje.pl/pictures/d.jpg',
    );
  });

  it('skips a disallowed candidate and falls back to the next one', () => {
    const html =
      ld({ '@type': 'Recipe', image: 'https://evil.example/a.jpg' }) + og('https://cdn.aniagotuje.com/b.jpg');
    expect(extractImageUrl(html, PAGE)).toBe('https://cdn.aniagotuje.com/b.jpg');
  });

  it('survives malformed JSON-LD', () => {
    const html = '<script type="application/ld+json">{nope</script>' + og('https://cdn.aniagotuje.com/b.jpg');
    expect(extractImageUrl(html, PAGE)).toBe('https://cdn.aniagotuje.com/b.jpg');
  });

  it('returns null when the page has no usable image', () => {
    expect(extractImageUrl('<html></html>', PAGE)).toBeNull();
    expect(extractImageUrl(og('https://evil.example/a.jpg'), PAGE)).toBeNull();
  });
});

describe('isAllowedImageUrl', () => {
  it.each([
    ['https://cdn.aniagotuje.com/a.jpg', true],
    ['https://jadlonomia.com/a.jpg', true],
    ['http://cdn.aniagotuje.com/a.jpg', false],
    ['https://evil.example/a.jpg', false],
    ['https://cdn.aniagotuje.com.evil.example/a.jpg', false],
    ['javascript:alert(1)', false],
    ['not a url', false],
  ])('%s -> %s', (url, expected) => {
    expect(isAllowedImageUrl(url)).toBe(expected);
  });
});
