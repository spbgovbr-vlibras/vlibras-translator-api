FROM public.ecr.aws/docker/library/node:hydrogen-alpine AS build

RUN apk add --no-cache make g++ python3

COPY . /src
WORKDIR /src

RUN npm ci \
  && npm prune --production

FROM public.ecr.aws/docker/library/node:hydrogen-alpine

RUN npm install -g sequelize-cli

COPY --from=build /src/node_modules node_modules
COPY --from=build /src/src src
COPY --from=build /src/bootstrap.sh bootstrap.sh
COPY --from=build /src/package.json package.json
COPY --from=build /src/.sequelizerc .sequelizerc

ENV DEBUG vlibras-translator-*:*
ENV NODE_ENV=production

CMD ["sh", "bootstrap.sh"]