<div align="center">
  <a href="http://www.vlibras.gov.br/">
    <img
      alt="VLibras"
      src="http://www.vlibras.gov.br/assets/imgs/IcaroGrande.png"
    />
  </a>
</div>

# VLibras Translator (API)

VLibras Translation Service API.

![Version](https://img.shields.io/badge/version-v2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-LGPLv3-blue.svg)
![VLibras](https://img.shields.io/badge/vlibras%20suite-2019-green.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAUCAYAAAC9BQwsAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAAB3RJTUUH4wIHCiw3NwjjIgAAAQ9JREFUOMuNkjErhWEYhq/nOBmkDNLJaFGyyyYsZzIZKJwfcH6AhcFqtCvFDzD5CQaTFINSlJJBZHI6J5flU5/P937fube357m63+d+nqBEagNYA9pAExgABxHxktU3882hjqtd9d7/+lCPsvpDZNA+MAXsABNU6xHYQ912ON2qC2qQ/X+J4XQXEVe/jwawCzwNAZp/NCLiDVgHejXgKIkVdGpm/FKXU/BJDfytbpWBLfWzAjxVx1Kuxwno5k84Jex0IpyzdN46qfYSjq18bzMHzQHXudifgQtgBuhHxGvKbaPg0Klaan7GdqE2W39LOq8OCo6X6kgdeJ4IZKUKWq1Y+GHVjF3gveTIe8BiCvwBEZmRAXuH6mYAAAAASUVORK5CYII=)

## Table of Contents

- **[Getting Started](#getting-started)**
  - [System Requirements](#system-requirements)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- **[Documentation](#documentation)**
- **[Deployment](#deployment)**
  - [Deploy Tools](#deploy-tools)
  - [Deploying](#deploying)
- **[Contributors](#contributors)**
- **[License](#license)**

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### System Requirements

* OS: Ubuntu 18.04.2 LTS (Bionic Beaver)

### Prerequisites

Before starting the installation, you need to install some prerequisites:

[Node.js](https://nodejs.org/en/)

```sh
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
```

```sh
sudo apt install -y nodejs
```
<br/>

[MongoDB](https://www.mongodb.com/)

```sh
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
```

```sh
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
```

```sh
sudo apt update
```

```sh
sudo apt install -y mongodb-org
```
<br/>

[RabbitMQ](https://www.rabbitmq.com/)

```sh
wget -O - "https://packagecloud.io/rabbitmq/rabbitmq-server/gpgkey" | sudo apt-key add -
```

```sh
curl -s https://packagecloud.io/install/repositories/rabbitmq/rabbitmq-server/script.deb.sh | sudo bash
```

```sh
sudo apt install -y rabbitmq-server --fix-missing
```

### Installing

After installing all the prerequisites, install the project by running the command:

```sh
cd api/
```

```sh
npm install
```

To test the installation, simply start the translation server with the following command:

```sh
cd api/
```

```sh
npm run dev
```

## Documentation

To access the documentation and usage examples of the VLibras Translator API, start the translation server in your localhost and open a browser with the following link:

```sh
 http://localhost:3000/docs
```

## Deployment

> In writting process

<!-- These instructions will get you a copy of the project up and running on a live System.

### Deploy Tools

To fully deployment of this project its necessary to have installed and configured the Docker Engine and Kubernetes Container Orchestration.

[Docker](https://www.docker.com/)

Update the apt package index:

```sh
sudo apt update
```

Install packages to allow apt to use a repository over HTTPS:

```sh
sudo apt install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common
```

Add Docker’s official GPG key:

```sh
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
```

Use the following command to set up the stable repository:

```sh
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
```

Update the apt package index:

```sh
sudo apt update
```

Install the latest version of Docker and containerd:

```sh
sudo apt install -y docker-ce docker-ce-cli containerd.io
```

<br/>

[Kubernetes](https://kubernetes.io/)

Update the apt package index:

```sh
sudo apt update
```

Install packages to allow apt to use a repository over HTTPS:

```sh
sudo apt install -y apt-transport-https
```

Add Kubernetes’s official GPG key:

```sh
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
```

Use the following command to set up the main repository:

```sh
echo "deb https://apt.kubernetes.io/ kubernetes-bionic main" | sudo tee -a /etc/apt/sources.list.d/kubernetes.list
```

Update the apt package index:

```sh
sudo apt update
```

Install the kubectl:

```sh
sudo apt install -y kubectl
```

### Deploying

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

Then, open the server.yaml file and edit the environment variables below to match your settings.

```sh
- name: AMQP_HOST
  value: "RabbitMQ-ClusterIP"
- name: AMQP_PORT
  value: "RabbitMQ-Port"
- name: DB_HOST
  value: "MongoDB-ClusterIP"
- name: DB_PORT
  value: "MongoDB-Port"
```

Finally, starting the server by running the commands:

```sh
kubectl apply -f kubernetes/server.yaml
```

```sh
kubectl expose deployment translatorapi --port=80 --type=LoadBalancer
``` -->

## Contributors

* Jonathan Brilhante - <jonathan.brilhante@lavid.ufpb.br>
* Wesnydy Ribeiro - <wesnydy@lavid.ufpb.br>

## License

This project is licensed under the LGPLv3 License - see the [LICENSE](LICENSE) file for details.
