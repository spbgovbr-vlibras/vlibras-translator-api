FROM node:hydrogen-bullseye AS build

RUN apt update && apt install -y make g++

COPY . /src
WORKDIR /src

RUN npm ci \
  && npm prune --production

FROM node:hydrogen-bullseye

RUN npm install -g sequelize-cli

COPY --from=build /src/node_modules node_modules
COPY --from=build /src/src src
COPY --from=build /src/bootstrap.sh bootstrap.sh
COPY --from=build /src/package.json package.json
COPY --from=build /src/.sequelizerc .sequelizerc

ENV DEBUG vlibras-translator-*:*
ENV NODE_ENV=production


CMD ["bash", "bootstrap.sh"]
