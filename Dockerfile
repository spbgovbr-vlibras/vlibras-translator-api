FROM node

RUN apt-get update && apt-get install build-essential checkinstall libreadline-gplv2-dev libncursesw5-dev libssl-dev libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev software-properties-common wget -y

ADD api translator-api

WORKDIR translator-api/

RUN npm install && npm audit fix

ENTRYPOINT npm start
