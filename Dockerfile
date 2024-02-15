FROM node:dubnium-alpine AS build

RUN apk --no-cache add python make g++

COPY . /src
WORKDIR /src

RUN npm ci \
  && npm run build \
  && npm prune --production

FROM node:dubnium-alpine

COPY --from=build /src/node_modules node_modules
COPY --from=build /src/dist dist
COPY --from=build /src/bootstrap.sh bootstrap.sh
COPY --from=build /src/.sequelizerc .sequelizerc

ENV DEBUG vlibras-translator-*:*
ENV NODE_ENV production

CMD ["sh", "bootstrap.sh"]
