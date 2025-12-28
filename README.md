# 📚 Distributed Online Store (DOS) – Part 2

> **Replication, Consistency, Load Balancing & Caching**

A distributed microservices-based online bookstore with advanced features including primary-backup replication, strong consistency guarantees, intelligent load balancing, and in-memory caching for enhanced availability and performance.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Replication & Consistency Model](#replication--consistency-model)
- [Load Balancing Strategy](#load-balancing-strategy)
- [Caching Mechanism](#caching-mechanism)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
- [Experiments & Evaluation](#experiments--evaluation)

---

## 🎯 Project Overview

This project extends Part 1 of the Distributed Online Store (DOS) by introducing enterprise-grade distributed systems features. The enhanced system provides improved availability, fault tolerance, and performance through strategic replication, caching, and load distribution.

Built with a microservices architecture using Node.js, Express, and SQLite, the system demonstrates core distributed systems concepts including consistency models, cache coherence, and service replication patterns.

---

## 🏗️ System Architecture

The system comprises three core microservices working in concert:

### **Front Service (API Gateway)**

The front service acts as the single entry point for all client interactions:

- Routes and orchestrates requests to backend services
- Maintains an in-memory cache for frequently accessed data
- Implements round-robin load balancing across service replicas
- Handles cache invalidation through server-push notifications
- Runs as a single instance (non-replicated)

### **Catalog Service**

The catalog service manages the book inventory and product information:

- Stores comprehensive book data including price, stock levels, and categories
- Implements **Primary–Backup replication** for high availability
- Enforces single-writer pattern where only the primary handles modifications
- Distributes read load across backup replicas
- Guarantees strong consistency across all replicas

### **Order Service**

The order service processes customer purchases:

- Handles all purchase transaction requests
- Replicated across multiple instances for fault tolerance
- Each replica maintains its own independent order database
- Always coordinates with the Catalog Primary for inventory updates
- Ensures atomicity of purchase operations

---

## ✨ Key Features

### 🔄 **Replication**

- Primary-Backup pattern for Catalog service
- Multi-instance deployment for Order service
- Automatic failover capabilities

### 🎯 **Strong Consistency**

- Single-writer enforcement
- Synchronous replication to backups
- Cache invalidation on writes

### ⚖️ **Load Balancing**

- Round-robin distribution algorithm
- Even request distribution across replicas
- Improved system throughput

### ⚡ **Performance Optimization**

- In-memory caching layer
- TTL-based cache expiration
- LRU eviction policy
- Reduced backend load

---

## 🔄 Replication & Consistency Model

The system employs a sophisticated consistency model to ensure data integrity while maximizing availability:

- **Single-Writer Principle**: Only the Catalog Primary accepts write operations, preventing conflicts and ensuring linearizability
- **Synchronous Replication**: Write operations are propagated from primary to backup replicas before acknowledging success
- **Cache Coherence**: Server-push invalidation ensures the front-end cache never serves stale data
- **Strong Consistency Guarantee**: All reads reflect the most recent completed write operation

This design prioritizes consistency over availability for critical inventory data while maintaining high performance through intelligent caching and read distribution.

---

## ⚖️ Load Balancing Strategy

The front service implements a **Round Robin** load balancing algorithm that:

- Maintains a circular queue of available service replicas
- Distributes incoming requests sequentially across all healthy instances
- Ensures fair resource utilization and prevents hotspots
- Automatically adapts to replica availability changes
- Provides predictable and uniform load distribution

This simple yet effective approach maximizes throughput and minimizes response latency across the distributed system.

---

## ⚡ Caching Mechanism

The in-memory cache in the front service significantly improves read performance:

### Cache Features

- **Read-Only Optimization**: Caches responses for `GET` requests (book details, search results)
- **TTL-Based Expiration**: Configurable time-to-live prevents indefinite stale data retention
- **LRU Eviction**: Least Recently Used policy when cache reaches capacity limits
- **Server-Push Invalidation**: Proactive cache clearing before write operations ensure consistency

### Invalidation Flow

1. Catalog Primary receives a write request (price update, stock change)
2. Primary sends invalidation request to Front service
3. Front service removes affected cache entries
4. Write operation proceeds at Primary
5. Subsequent reads fetch fresh data and repopulate cache

This approach eliminates cache coherence issues while maintaining excellent cache hit rates for read-heavy workloads.

---

## 🛠️ Technologies Used

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment for microservices |
| **Express.js** | Web framework for REST API implementation |
| **SQLite** (better-sqlite3) | Lightweight embedded database for each service |
| **Docker** | Containerization of services |
| **Docker Compose** | Multi-container orchestration and deployment |
| **REST APIs** | Inter-service communication protocol |

---

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Ports 3000-3005 available on your system

### Deployment

To deploy the complete distributed system:

```bash
# Reset environment and rebuild all services
docker compose down -v
docker compose up --build
```

The system will start with:

- 1 Front service instance (port 3000)
- 1 Catalog Primary + 2 Catalog Backups
- 2 Order service replicas

### Testing the System

```bash
# Search for books by topic
curl http://localhost:4000/search/distributed-systems

# Get book details (cached after first request)
curl http://localhost:4000/lookup/1

# Purchase a book (triggers cache invalidation)
curl -X POST http://localhost:4000/purchase/1
```

---

## 📊 Experiments & Evaluation

The system has been evaluated across multiple dimensions:

### Performance Metrics

- **Cache Efficiency**: Measured cache hit vs miss ratios under various load patterns
- **Load Distribution**: Verified even request distribution across replicas using round-robin
- **Latency Impact**: Quantified response time improvements with caching enabled

### Consistency Verification

- **Strong Consistency**: Validated that no stale reads occur after write operations
- **Invalidation Latency**: Measured time between write and cache invalidation
- **Replication Lag**: Monitored synchronization delay between primary and backups

### Observations

- Cache hit rates exceed 80% for read-heavy workloads
- Round-robin achieves ±5% deviation in request distribution
- Cache invalidation completes within milliseconds, maintaining consistency
- System maintains availability even with single replica failures

---

## 📝 License

This project is part of an academic distributed systems course.

---

## 🤝 Contributing

This is an educational project. For questions or improvements, please open an issue or submit a pull request.

---
