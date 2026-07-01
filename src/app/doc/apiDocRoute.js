import fs from 'fs';
import express, { Router } from 'express';
import { createRequire } from 'module';
import crypto from 'crypto';
import createError from 'http-errors';

const require = createRequire(import.meta.url);
const swaggerUiDist = require('swagger-ui-dist');

const swaggerDoc = JSON.parse(fs.readFileSync('./src/app/doc/openapi.json', 'utf8'));
const swaggerUiAssetPath = swaggerUiDist.getAbsoluteFSPath();
const docsEnabled = process.env.DOCS_ENABLED === 'true'
  || (process.env.NODE_ENV !== 'production' && process.env.DOCS_ENABLED !== 'false');
const allowedConnectOrigins = [
  "'self'",
  ...new Set(
    (swaggerDoc.servers || [])
      .map(({ url }) => {
        try {
          return new URL(url).origin;
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  ),
];
const swaggerUiInit = `window.onload = function onSwaggerUiLoad() {
  window.ui = SwaggerUIBundle({
    spec: ${JSON.stringify(swaggerDoc)},
    dom_id: '#swagger-ui',
    deepLinking: true,
    queryConfigEnabled: false,
    validatorUrl: null,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset,
    ],
    layout: 'StandaloneLayout',
  });
};`;
const buildSwaggerUiHtml = (nonce) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>VLibras Docs</title>
  <link rel="stylesheet" type="text/css" href="./assets/swagger-ui.css">
  <style>
    html {
      box-sizing: border-box;
      overflow-y: scroll;
    }

    *, *::before, *::after {
      box-sizing: inherit;
    }

    body {
      margin: 0;
      background: #fafafa;
    }

    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="./assets/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script src="./assets/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
  <script nonce="${nonce}">${swaggerUiInit}</script>
</body>
</html>`;

const setDocsHeaders = (_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    `script-src 'self' 'nonce-${res.locals.cspNonce}'`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${allowedConnectOrigins.join(' ')}`,
  ].join('; '));
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
};

const apiDocRoute = Router();

apiDocRoute.use('/docs', (req, res, next) => {
  if (!docsEnabled) {
    next(createError(404));
    return;
  }

  next();
});
apiDocRoute.use('/docs', setDocsHeaders);
apiDocRoute.use('/docs/assets', express.static(swaggerUiAssetPath, {
  index: false,
  fallthrough: false,
}));
apiDocRoute.get(/^\/docs$/, (_req, res) => {
  res.redirect(301, 'docs/');
});
apiDocRoute.get('/docs/', (_req, res) => {
  res.type('html').send(buildSwaggerUiHtml(res.locals.cspNonce));
});
apiDocRoute.get('/docs/index.html', (_req, res) => {
  res.type('html').send(buildSwaggerUiHtml(res.locals.cspNonce));
});
apiDocRoute.get('/docs/swagger-ui-init.js', (_req, res) => {
  res.type('application/javascript').send(swaggerUiInit);
});

export default apiDocRoute;
