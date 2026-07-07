FROM public.ecr.aws/docker/library/node:24-alpine3.22 AS build

RUN apk add --no-cache make g++ python3

COPY . /src
WORKDIR /src

RUN npm ci \
  && npm prune --production

FROM public.ecr.aws/docker/library/node:24-alpine3.22

WORKDIR /app

COPY --from=build --chown=node:node /src/node_modules node_modules
COPY --from=build --chown=node:node /src/src src
COPY --from=build --chown=node:node /src/bootstrap.sh bootstrap.sh
COPY --from=build --chown=node:node /src/package.json package.json
COPY --from=build --chown=node:node /src/.sequelizerc .sequelizerc

ENV DEBUG vlibras-translator-*:*
ENV NODE_ENV=production

USER node

CMD ["sh", "bootstrap.sh"]
