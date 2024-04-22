<div align="center">
  <a href="http://www.vlibras.gov.br/">
    <img
      alt="VLibras"
      src="https://vlibras.gov.br/assets/imgs/IcaroGrande.png"
    />
  </a>
</div>

# VLibras Translator (API)

VLibras Translation Service API.

![Version](https://img.shields.io/badge/version-v2.4.0-blue.svg)
![License](https://img.shields.io/badge/license-LGPLv3-blue.svg)
![VLibras](https://img.shields.io/badge/vlibras%20suite-2019-green.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAUCAYAAAC9BQwsAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAAB3RJTUUH4wIHCiw3NwjjIgAAAQ9JREFUOMuNkjErhWEYhq/nOBmkDNLJaFGyyyYsZzIZKJwfcH6AhcFqtCvFDzD5CQaTFINSlJJBZHI6J5flU5/P937fube357m63+d+nqBEagNYA9pAExgABxHxktU3882hjqtd9d7/+lCPsvpDZNA+MAXsABNU6xHYQ912ON2qC2qQ/X+J4XQXEVe/jwawCzwNAZp/NCLiDVgHejXgKIkVdGpm/FKXU/BJDfytbpWBLfWzAjxVx1Kuxwno5k84Jex0IpyzdN46qfYSjq18bzMHzQHXudifgQtgBuhHxGvKbaPg0Klaan7GdqE2W39LOq8OCo6X6kgdeJ4IZKUKWq1Y+GHVjF3gveTIe8BiCvwBEZmRAXuH6mYAAAAASUVORK5CYII=)

## Table of Contents

- **[Getting Started](#getting-started)**
  - [System Requirements](#system-requirements)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- **[Deployment](#deployment)**
  - [Deploy Tools](#deploy-tools)
  - [Deploying](#deploying)
- **[Documentation](#documentation)**
- **[Contributors](#contributors)**
- **[License](#license)**

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### System Requirements

* OS: Ubuntu 22.04 LTS (Jammy Jellyfish)

### Prerequisites

Before starting the installation, you need to install some prerequisites.

##### [Node.js](https://nodejs.org/en/)

Use [nvm](https://github.com/nvm-sh/nvm) to install node (relogin to finish the installation).

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
```

Install Node.js 12.

```sh
nvm install 12
```

##### [PostgreSQL](https://www.postgresql.org/)

Update local package database.

```sh
sudo apt-get update
```

Import the public key used by the package management system.

```sh
curl -fSsL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | sudo tee /usr/share/keyrings/postgresql.gpg > /dev/null
```

Configure repository.

```sh
echo deb [arch=amd64,arm64,ppc64el signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main | sudo tee /etc/apt/sources.list.d/postgresql.list
```

Update local package database.

```sh
sudo apt update
```

Install the PostgreSQL packages.

```sh
sudo apt-get install postgresql-15
```

Verifying the installation

```sh
sudo systemctl status postgresql.service
```

Connecting and configuring postgreSQL

```sh
sudo -u postgres psql
```

```sh
alter user postgres password 'senha';
```

```sh
\q
```

```sh
psql -h localhost -U postgres
```

```sh
CREATE DATABASE vlibras;
```

```sh
\c vlibras
```

Update the dabase configuration at [.env.dev](src/config/environments/.env.dev)
```
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=vlibras
```

##### [Jest And Supertest]()

Configure env file

1. Create a env test file at [.env.test](src/config/environments/). Use [.env.example](src/config/environments/.env.example) as example.
2. Configure environments variable according your infrastructure (ex: database, redis, rabbitmq, vlibras-text-core, etc) 

Running tests.

```sh
npm run test:watch
```




##### [Redis](https://redis.io)

Update local apt package.

```sh
sudo apt update
```

Install Redis.

```sh
sudo apt install redis-server
```


##### [RabbitMQ](https://www.rabbitmq.com/)

Follow the [Quick Start script](https://www.rabbitmq.com/install-debian.html#apt-quick-start-cloudsmith) from RabbitMQ:

```sh
#!/bin/sh

sudo apt-get install curl gnupg apt-transport-https -y

## Team RabbitMQ's main signing key
curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" | sudo gpg --dearmor | sudo tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null
## Community mirror of Cloudsmith: modern Erlang repository
curl -1sLf https://ppa1.novemberain.com/gpg.E495BB49CC4BBE5B.key | sudo gpg --dearmor | sudo tee /usr/share/keyrings/rabbitmq.E495BB49CC4BBE5B.gpg > /dev/null
## Community mirror of Cloudsmith: RabbitMQ repository
curl -1sLf https://ppa1.novemberain.com/gpg.9F4587F226208342.key | sudo gpg --dearmor | sudo tee /usr/share/keyrings/rabbitmq.9F4587F226208342.gpg > /dev/null

## Add apt repositories maintained by Team RabbitMQ
sudo tee /etc/apt/sources.list.d/rabbitmq.list <<EOF
## Provides modern Erlang/OTP releases
##
deb [signed-by=/usr/share/keyrings/rabbitmq.E495BB49CC4BBE5B.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-erlang/deb/ubuntu jammy main
deb-src [signed-by=/usr/share/keyrings/rabbitmq.E495BB49CC4BBE5B.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-erlang/deb/ubuntu jammy main

## Provides RabbitMQ
##
deb [signed-by=/usr/share/keyrings/rabbitmq.9F4587F226208342.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-server/deb/ubuntu jammy main
deb-src [signed-by=/usr/share/keyrings/rabbitmq.9F4587F226208342.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-server/deb/ubuntu jammy main
EOF

## Update package indices
sudo apt-get update -y

## Install Erlang packages
sudo apt-get install -y erlang-base \
                        erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
                        erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
                        erlang-runtime-tools erlang-snmp erlang-ssl \
                        erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl

## Install rabbitmq-server and its dependencies
sudo apt-get install rabbitmq-server -y --fix-missing
```

### Installing

After installing all the prerequisites, install the project by running the command:

```sh
npm install
```

Load Sequelize Migrations

```sh
npm run build
```

```sh
NODE_ENV=dev npx sequelize db:migrate
```

To test the installation, build and start the translation API with the following command:

```sh
npm run dev
```

## Deployment

These instructions will get you a copy of the project up and running on a live System.

### Deploy Tools

To fully deployment of this project its necessary to have installed and configured the Docker Engine and Kubernetes Container Orchestration.

##### [Docker](https://www.docker.com/)

Update the apt package index.

```sh
sudo apt update
```

Install packages to allow apt to use a repository over HTTPS.

```sh
sudo apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
```

Add Docker’s official GPG key.

```sh
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
```

Set up the stable repository.

```sh
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
```

Update the apt package index.

```sh
sudo apt update
```

Install the latest version of Docker and containerd.

```sh
sudo apt install -y docker-ce docker-ce-cli containerd.io
```

##### [Kubernetes](https://kubernetes.io/)

Update the apt package index.

```sh
sudo apt update
```

Install packages to allow apt to use a repository over HTTPS.

```sh
sudo apt install -y apt-transport-https
```

Add Kubernetes’s official GPG key.

```sh
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
```

Set up the main repository.

```sh
echo "deb https://apt.kubernetes.io/ kubernetes-bionic main" | sudo tee -a /etc/apt/sources.list.d/kubernetes.list
```

Update the apt package index.

```sh
sudo apt update
```

Install the kubectl.

```sh
sudo apt install -y kubectl
```

### Deploying
Note: Vlibras Translator Api has some dependencies with other components. Make sure that you previously deployed Vlibras Translator Text Core and Vlibras Translator Video Core.
> Note: if you already have MongoDB and RabbitMQ running on your cluster, skip to the server configuration.

Once kubectl is installed and set, run the following commands:

```sh
kubectl apply -f kubernetes/mongo.yaml
```

```sh
kubectl expose rc mongo-controller --type=ClusterIP
```

The commands above will start the MongoDB pods. You must configure a volume set to be used by it. By default it set to be used in a Google Cloud Platform (GCP). Following, the commands bellow starts up the RabbitMQ pod. As it happened to MongoDB, you must configure a volume set or use the default of a GCP.

```sh
kubectl apply -f kubernetes/rabbitmq.yaml
```

```sh
kubectl expose deployment rabbitmq --type=ClusterIP
```

Then, open the translator-api-server-template.yaml file and edit the environment variables below to match your settings.

```sh
- name: AMQP_HOST
  value: "RABBITMQ-IP"
- name: AMQP_PORT
  value: "RABBITMQ-PORT"
- name: DB_HOST
  value: "MONGODB-IP"
- name: DB_PORT
  value: "MONGODB-PORT"
```

Finally, starting the server by running the commands:

```sh
kubectl apply -f kubernetes/translator-api-server-template.yaml
```

```sh
kubectl expose deployment translatorapi --port=80 --type=LoadBalancer
```

## Documentation

To access the documentation and usage examples of the VLibras Translator API, start the translation server in your localhost and open a browser with the following link:

[http://localhost:3000/docs](http://localhost:3000/docs)

## Contributors

* Jonathan Brilhante - <jonathan.brilhante@lavid.ufpb.br>
* Wesnydy Ribeiro - <wesnydy@lavid.ufpb.br>

## License

This project is licensed under the LGPLv3 License - see the [LICENSE](LICENSE) file for details.
