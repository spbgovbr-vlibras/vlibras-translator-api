FROM public.ecr.aws/docker/library/node:24-alpine3.22 AS build

RUN apk upgrade --no-cache libcrypto3 libssl3 \
  && apk add --no-cache make g++ python3

COPY . /src
WORKDIR /src

RUN npm ci \
  && npm prune --production

FROM public.ecr.aws/docker/library/node:24-alpine3.22

WORKDIR /app

RUN apk upgrade --no-cache libcrypto3 libssl3

COPY --from=build --chown=node:node /src/node_modules node_modules
COPY --from=build --chown=node:node /src/src src
COPY --from=build --chown=node:node /src/bootstrap.js bootstrap.js
COPY --from=build --chown=node:node /src/package.json package.json
COPY --from=build --chown=node:node /src/.sequelizerc .sequelizerc

RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

ARG NODE_ENV=production
ENV DEBUG=vlibras-translator-*:*
ENV NODE_ENV=$NODE_ENV

USER node

CMD ["node", "bootstrap.js"]
