import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RecipePhoto } from '@/components/recipes/RecipePhoto';

const SRC = 'https://cdn.aniagotuje.com/a.jpg';

describe('RecipePhoto', () => {
  it('renders the photo layer, with a scrim on request', () => {
    const { container } = render(<RecipePhoto src={SRC} sizes="100vw" scrim />);
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();
  });

  it('renders nothing without a photo or for a host outside the allow-list', () => {
    expect(render(<RecipePhoto src={null} sizes="100vw" />).container).toBeEmptyDOMElement();
    expect(render(<RecipePhoto src="https://evil.example/a.jpg" sizes="100vw" />).container).toBeEmptyDOMElement();
  });

  it('renders nothing once the image fails to load, so the cover colour shows', () => {
    const { container } = render(<RecipePhoto src={SRC} sizes="100vw" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container).toBeEmptyDOMElement();
  });
});
