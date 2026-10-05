/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Design smoke test: keeps the Clearframe-style shell (paper/forest layout)
 * from silently losing its structural classes.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

const DIRECTORY_CLASSES = [
  'page-shell',
  'skip-link',
  'site-header',
  'brand-mark',
  'local-badge',
  'eyebrow',
  'hero-aside',
  'tool-card',
  'picker-zone',
  'picker-aside',
  'search-field',
  'filter-pill',
  'tool-grid',
  'tool-tile',
  'principle-card',
  'highlighted-card',
  'site-footer',
];

describe('ZeroKit shell', () => {
  it('renders the tool directory with the full layout', () => {
    const html = renderToStaticMarkup(<App />);
    DIRECTORY_CLASSES.forEach((cls) => expect(html).toContain(cls));
    expect(html).toContain('Nothing leaves the tab.');
    expect(html).toContain('Pick a tool. Start at once.');
  });
});
