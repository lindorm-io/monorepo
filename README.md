# @lindorm/monorepo

A comprehensive TypeScript library ecosystem for building secure, scalable web applications with advanced cryptography, data persistence, event sourcing, and infrastructure utilities.

## Overview

The Lindorm monorepo is a collection of 40+ TypeScript packages that provide enterprise-grade solutions for modern application development. Built with modularity, type safety, test safety, and security at its core, Lindorm offers everything from cryptographic operations to event sourcing frameworks.

## Disclaimer

This is a monorepo that I primarily use to learn new technologies and test ideas. Programming (and especially TS in NodeJS) is my special interest - my passion. I hold every package to the highest possible quality standards, because that's how I am as a person. However, there's only so many hours in a day. So while some packages are production ready (I have some forks of pylon, logger, mongo, conduit, and redis in production) - not all of them are.

### Key Features

- 🔐 **Comprehensive Security Suite**: JWT/JWE/JWS, multiple encryption algorithms, key management
- 📊 **Multiple Database Support**: MongoDB, PostgreSQL, Redis, InMemory with similar repository patterns
- 🎯 **Event Sourcing & CQRS**: Complete implementation with aggregates, sagas, event encryption, event hashing, and projections for multiple different data sources
- 🌐 **HTTP & WebSocket Support**: Server framework with middleware composition
- 🔧 **Developer Experience**: Full TypeScript support, full test coverage, consistent APIs
- 📦 **Modular Architecture**: Use only what you need, tree-shakeable packages

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Package Overview](#package-overview)
- [Quick Start Examples](#quick-start-examples)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

### Prerequisites

- Node.js >= 20.11.0
- Docker & Docker Compose (for running integration tests)

### System Setup

```bash
# Clone the repository
git clone https://github.com/your-org/lindorm-monorepo.git
cd lindorm-monorepo

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests to verify setup
npm run typecheck
npm run test
```

## Installation

Lindorm packages are published to npm under the `@lindorm` scope. Install only the packages you need:

```bash
# Cryptography
npm install @lindorm/aegis      # JWT/JWE/JWS/CWT/CWE/CWS operations
npm install @lindorm/aes        # AES operations using kryptos
npm install @lindorm/amphora    # Key store and OpenID configuration management
npm install @lindorm/kryptos    # Easy key management for EC/RSA/OKP/oct keys
npm install @lindorm/enigma     # Password hashing

# Data & Storage
npm install @lindorm/entity     # Entity decorator utilities used for mongo, redis, and mnemos
npm install @lindorm/mongo      # MongoDB utilities
npm install @lindorm/postgres   # PostgreSQL utilities
npm install @lindorm/redis      # Redis utilities
npm install @lindorm/mnemos     # In Memory utilities

# Infrastructure
npm install @lindorm/pylon      # Web and socket server framework
npm install @lindorm/conduit    # HTTP client layer on top of axios or fetch
npm install @lindorm/rabbit     # RabbitMQ integration
npm install @lindorm/logger     # Rich logger layer on top of winston with readable dev logs
npm install @lindorm/worker     # Interval worker with retry logic and error handling

# Event Sourcing
npm install @lindorm/hermes     # Event sourcing/CQRS framework
```

## License

This project is licensed under the AGPL-3.0-or-later License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with ❤️ using:
- [TypeScript](https://www.typescriptlang.org/)
- [Jest](https://jestjs.io/)
- [Lerna](https://lerna.js.org/)
- [Docker](https://www.docker.com/)
