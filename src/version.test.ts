import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { APP_VERSION } from './version';

/**
 * PIN: "the app version and package.json cannot disagree."
 * Watched red by bumping src/version.ts alone (see docs/TESTING.md).
 */
describe('APP_VERSION', () => {
  it('matches the version in package.json', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };

    expect(APP_VERSION).toBe(manifest.version);
  });
});
