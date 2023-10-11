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

* OS: Ubuntu 18.04.3 LTS (Bionic Beaver)

### Prerequisites

Before starting the installation, you need to install some prerequisites.

##### [Node.js](https://nodejs.org/en/)

Add NodeSource repository.

```sh
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
```

Install Node.js.

```sh
sudo apt install -y nodejs
```

##### [MongoDB](https://www.mongodb.com/)

Update local package database.

```sh
sudo apt update
```

Install required libraries.

```sh
sudo apt install -y wget gnupg
```

Import the public key used by the package management system.

```sh
wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | sudo apt-key add -
```

Create a list file for MongoDB.

```sh
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.2.list
```

Reload local package database.

```sh
sudo apt update
```

Install the MongoDB packages.

```sh
sudo apt install -y mongodb-org
```

You can start the mongod process by issuing the following command:

```sh
sudo systemctl start mongod
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

Update package indices.

```sh
sudo apt update
```

Install prerequisites.

```sh
sudo apt install -y curl gnupg apt-transport-https
```

Install RabbitMQ signing key.

```sh
curl -fsSL https://github.com/rabbitmq/signing-keys/releases/download/2.0/rabbitmq-release-signing-key.asc | sudo apt-key add -
```

Add Bintray repositories that provision latest RabbitMQ and Erlang 21.x releases.

```sh
echo "deb https://dl.bintray.com/rabbitmq-erlang/debian bionic erlang-21.x" | tee /etc/apt/sources.list.d/bintray.rabbitmq.list
```

```sh
echo "deb https://dl.bintray.com/rabbitmq/debian bionic main" | tee -a /etc/apt/sources.list.d/bintray.rabbitmq.list
```

Update package indices.

```sh
sudo apt update
```

Install rabbitmq-server and its dependencies.

```sh
sudo apt install rabbitmq-server -y --fix-missing
```

### Installing

After installing all the prerequisites, install the project by running the command:

```sh
npm install
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
