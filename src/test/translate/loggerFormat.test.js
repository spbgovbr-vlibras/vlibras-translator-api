import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import { describe, expect, it } from '@jest/globals';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const readConfiguredFormat = (relativePath, pattern) => {
  const content = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  const match = content.match(pattern);

  return match === null ? undefined : match[1];
};

// Public API exposed on the morgan object, not format names.
const MORGAN_API_KEYS = ['compile', 'format', 'token'];

/**
 * morgan.format(name, fmt) registers formats as properties of morgan itself:
 * every built-in is a format string except "dev", which is a function.
 *
 * Morgan does not throw on an unknown name: getFormatFunction falls back to
 * compiling the name itself as a format string, so a typo silently turns every
 * access log line into that literal string.
 */
const isRegisteredMorganFormat = (format) => !MORGAN_API_KEYS.includes(format)
  && ['string', 'function'].includes(typeof morgan[format]);

const MORGAN_FORMATS = ['combined', 'common', 'dev', 'short', 'tiny'];

describe('Morgan format names', () => {
  it.each(MORGAN_FORMATS)('should register the "%s" format', (format) => {
    expect(isRegisteredMorganFormat(format)).toBe(true);
  });

  it('should not register environment names as formats', () => {
    expect(morgan.production).toBeUndefined();
    expect(isRegisteredMorganFormat('production')).toBe(false);
  });

  it('should not mistake the morgan api for a format name', () => {
    MORGAN_API_KEYS.forEach((apiKey) => {
      expect(isRegisteredMorganFormat(apiKey)).toBe(false);
    });
  });

  it('should compile an unknown name into a literal line instead of throwing', () => {
    const line = morgan.compile('production')(morgan, {}, {});

    expect(line).toBe('production');
  });
});

describe('Configured LOGGER_FORMAT', () => {
  it('should use a valid morgan format on the helm values', () => {
    const format = readConfiguredFormat(
      'deploy/helm/values.yaml',
      /^\s*LOGGER_FORMAT:\s*'([^']*)'/m,
    );

    expect(format).toBeDefined();
    expect(MORGAN_FORMATS).toContain(format);
    expect(isRegisteredMorganFormat(format)).toBe(true);
  });

  it('should use a valid morgan format on the env example', () => {
    const format = readConfiguredFormat(
      'src/config/environments/.env.example',
      /^LOGGER_FORMAT=(.*)$/m,
    );

    expect(format).toBeDefined();
    expect(MORGAN_FORMATS).toContain(format);
    expect(isRegisteredMorganFormat(format)).toBe(true);
  });

  it('should fall back to a valid morgan format when the variable is unset', () => {
    const appSource = fs.readFileSync(path.join(projectRoot, 'src/app/app.js'), 'utf8');
    const match = appSource.match(/logger\(env\.LOGGER_FORMAT \|\| '([^']+)'\)/);

    expect(match).not.toBeNull();
    expect(isRegisteredMorganFormat(match[1])).toBe(true);
  });
});
