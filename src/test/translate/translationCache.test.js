import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const redisStore = new Map();
const redisClient = {
  get: jest.fn(async (key) => (redisStore.has(key) ? redisStore.get(key) : null)),
};
const translationSave = jest.fn(async () => {});
const translationBuild = jest.fn(() => ({ save: translationSave }));

jest.unstable_mockModule('../../app/util/redisConnection.js', () => ({
  default: jest.fn(async () => redisClient),
}));

jest.unstable_mockModule('../../app/util/debugger.js', () => ({
  cacheError: jest.fn(),
  serverError: jest.fn(),
}));

jest.unstable_mockModule('../../app/db/models/index.js', () => ({
  default: {
    Translation: { build: translationBuild },
  },
}));

const {
  CACHE_NAMESPACES,
  buildTextHash,
  createTranslationCache,
  getCachedTranslation,
} = await import('../../app/middlewares/translationCache.js');

const createRequest = (text) => ({
  uid: 'uid-1',
  body: { text },
  headers: { 'x-forwarded-for': '10.0.0.1' },
  connection: { remoteAddress: '10.0.0.1' },
});

const createResponse = () => {
  const res = {
    statusCode: undefined,
    sent: undefined,
    jsonPayload: undefined,
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.send = jest.fn((payload) => {
    res.sent = payload;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.jsonPayload = payload;
    return res;
  });

  return res;
};

const SENTIMENT_PAYLOAD = {
  traducao: 'OI TUDO BEM',
  sentimentoGeral: 'positivo',
  sentimentoPorSentenca: [{ traducao: 'OI TUDO BEM', sentimento: 'positivo' }],
};

beforeEach(() => {
  redisStore.clear();
  jest.clearAllMocks();
});

describe('Cache key namespacing', () => {
  it('should prefix the hash with the namespace', () => {
    expect(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation))
      .toMatch(/^translate:[0-9a-f]{32}$/);
    expect(buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment))
      .toMatch(/^sentiment:[0-9a-f]{32}$/);
  });

  it('should build different keys per namespace for the same text', () => {
    expect(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation))
      .not.toBe(buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment));
  });

  it('should default to the translation namespace', () => {
    expect(buildTextHash('oi tudo bem'))
      .toBe(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation));
  });

  it('should keep the same key for the same text within a namespace', () => {
    expect(buildTextHash('Oi, tudo bem?', CACHE_NAMESPACES.translation))
      .toBe(buildTextHash('Oi, tudo bem?', CACHE_NAMESPACES.translation));
  });

  it('should read from the namespaced key', async () => {
    redisStore.set(buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment), 'valor-sentimento');

    const entry = await getCachedTranslation('oi tudo bem', CACHE_NAMESPACES.sentiment);

    expect(entry.cachedTranslation).toBe('valor-sentimento');
    expect(entry.textHash).toBe(buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment));
  });
});

describe('Translation cache middleware isolation', () => {
  it('should not serve a translation cache entry to the sentiment route', async () => {
    redisStore.set(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation), 'OI TUDO BEM');

    const req = createRequest('oi tudo bem');
    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.sentiment)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.send).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should not serve a sentiment cache entry to the translation route', async () => {
    redisStore.set(
      buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment),
      JSON.stringify(SENTIMENT_PAYLOAD),
    );

    const req = createRequest('oi tudo bem');
    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.translation)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('should expose the namespaced hash so each route writes to its own key', async () => {
    const translationReq = createRequest('oi tudo bem');
    const sentimentReq = createRequest('oi tudo bem');

    const translationCache = createTranslationCache(CACHE_NAMESPACES.translation);
    const sentimentCache = createTranslationCache(CACHE_NAMESPACES.sentiment);

    await translationCache(translationReq, createResponse(), jest.fn());
    await sentimentCache(sentimentReq, createResponse(), jest.fn());

    expect(translationReq.body.textHash).toBe(
      buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation),
    );
    expect(sentimentReq.body.textHash).toBe(
      buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment),
    );
    expect(translationReq.body.textHash).not.toBe(sentimentReq.body.textHash);
  });
});

describe('Translation cache middleware hits', () => {
  it('should serve the cached gloss as plain text on the translation route', async () => {
    redisStore.set(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation), 'OI TUDO BEM');

    const req = createRequest('oi tudo bem');
    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.translation)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.sent).toBe('OI TUDO BEM');
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should serve the cached sentiment payload as JSON', async () => {
    redisStore.set(
      buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment),
      JSON.stringify(SENTIMENT_PAYLOAD),
    );

    const req = createRequest('oi tudo bem');
    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.sentiment)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual(SENTIMENT_PAYLOAD);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('should count the gloss, not the JSON payload, on a sentiment cache hit', async () => {
    redisStore.set(
      buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment),
      JSON.stringify(SENTIMENT_PAYLOAD),
    );

    await createTranslationCache(CACHE_NAMESPACES.sentiment)(createRequest('oi tudo bem'), createResponse(), jest.fn());

    expect(translationBuild).toHaveBeenCalledWith({
      text: 'oi tudo bem',
      translation: 'OI TUDO BEM',
      requester: '10.0.0.1',
    });
  });

  it('should still answer when the hit counter fails', async () => {
    redisStore.set(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation), 'OI TUDO BEM');
    translationSave.mockRejectedValueOnce(new Error('db down'));

    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.translation)(createRequest('oi tudo bem'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.sent).toBe('OI TUDO BEM');
  });
});

describe('Translation cache middleware fallbacks', () => {
  it('should fall through when the sentiment entry is not valid JSON', async () => {
    redisStore.set(buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment), 'OI TUDO BEM');

    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.sentiment)(createRequest('oi tudo bem'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should fall through when the sentiment entry lacks the expected shape', async () => {
    redisStore.set(
      buildTextHash('oi tudo bem', CACHE_NAMESPACES.sentiment),
      JSON.stringify({ sentimentoGeral: 'positivo' }),
    );

    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.sentiment)(createRequest('oi tudo bem'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should fall through to the translator when Redis fails', async () => {
    redisClient.get.mockRejectedValueOnce(new Error('redis down'));

    const res = createResponse();
    const next = jest.fn();

    await createTranslationCache(CACHE_NAMESPACES.translation)(createRequest('oi tudo bem'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('should default the middleware namespace to translation', async () => {
    redisStore.set(buildTextHash('oi tudo bem', CACHE_NAMESPACES.translation), 'OI TUDO BEM');

    const res = createResponse();

    await createTranslationCache()(createRequest('oi tudo bem'), res, jest.fn());

    expect(res.sent).toBe('OI TUDO BEM');
  });
});
