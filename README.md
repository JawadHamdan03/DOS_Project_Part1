🏪 Bazar.com – A Multi-Tier Online Book Store

Bazar.com is a simple multi-tier bookstore built using Express.js and SQLite, following a microservices architecture.
It consists of three REST-based services:

1-Front Service (Port 4000) → the single entry point (API Gateway)

2-Catalog Service (Port 4001) → manages books, topics, prices, and stock

3-Order Service (Port 4002) → handles purchases and logs orders

All services communicate using HTTP REST calls and can run independently in Docker containers.

To Start the project you need to open the directory and then run the following commands :

  1-docker comopse build  : creates the images through the docker-compose.yaml.
  
  2-docker compose up : starts each server in a container on the mapped ports in docker-compose.yaml.
    
