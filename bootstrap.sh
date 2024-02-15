#!/bin/sh
if [[ -n $NODE_ENV ]]
then
    echo 'Run Postgres migrations'
    npx sequelize-cli db:migrate
    node ./dist/index.js
else
    echo -e "Environment variable NODE_ENV is required to start services"
    exit 1
fi