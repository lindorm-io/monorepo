# Table of Contents
- [Table of Contents](#table-of-contents)
- [What do we have here?](#what-do-we-have-here)
- [Interesting packages](#interesting-packages)
  - [AMQP](#amqp)
  - [Axios](#axios)
  - [Event Source](#event-source)
  - [JWT](#jwt)
  - [Key Pair](#key-pair)
  - [Koa](#koa)
  - [Winston](#winston)
- [Services](#services)
  - [Authentication Service](#authentication-service)
  - [Device Service](#device-service)
  - [OAuth Service](#oauth-service)
- [License](#license)

# What do we have here?
This monorepo is a versatile staging ground that hosts a variety of packages and services, each serving as a test bed for innovative concepts, enhancements to current technologies, and frameworks. It is crafted to demonstrate my proficiency across these domains. I am open to and appreciate all forms of feedback that could further refine and improve the offerings within this repository.

# Interesting packages
While there are 40+ packages under the catalog `/packages` I would like to direct your attention towards some specific ones:

## AMQP
This package leverages amqplib to make a robust, and yet simple to use framework for handling pub/sub message queues such as RabbitMQ.

## Axios
This package enhances the well known XMLHTTPREQUEST client axios and introduces some helpful tools to make life easier when handling configuration, dictionary key transformation, middleware, logging, and retries.

## Event Source
This package is heavily opinionated but simple to use framework for event sourcing. It includes both the event source storage, and the view model storage solutions, as well as saga and error handlers. It can store data in Mongo or Postgresql.

## JWT
This package improves upon the jsonwebtokenpackage and adds more standardization from the OAuth2.0/OIDC specification. It also includes a new standard opaque token generation utility based on the JWT spec.

## Key Pair
This package introduces standardized ways of creating EC/HS/RSA keys, and then encoding or decoding them into JWKS.

## Koa
This package makes it easier to create a new Koa and SocketIO webserver with automatic route discovery based on directory structure. It provides some opinionated but useful middleware automatically that makes it easier to get up and running quickly such as automatic case conversion on request and response body.

## Winston
This package improves upon the winston logger package and primarily adds filtering and improved and a colourised readable format.

# Services
Most of these services are currently being worked on to create a microservice architecture that can handle Authentication and Authorization in accordance with the OAuth2.0/OpenID Connect framework and specifications. I would like to highlight the following services:

## Authentication Service
This service handles all authentication related flows a customer might run into. It is built to work in tandem with the [OAuth Service](#oauth-service) but it is not a requirement. During an authentication flow, it will produce configuration for frontend to consume and render. The configuration holds a list of strategies sorted by the most prudent authentication strategy based on request details. Once the customer is authenticated, the service will generate an authentication token that can be used to either run your own session management, or to confirm an OAuth2.0 authorization session.

- [Authentication using Strategies with lindorm.io](https://swimlanes.io/u/2TTffs950)
- [Authentication using OIDC with lindorm.io](https://swimlanes.io/u/9uyMcHXMX)

## Device Service
This service is an attempt to create something that is similar to BankID. A secure device (such as a phone or tablet) can be registered (or enrolled) into the service. With this enrolment it can issue and sign device challenges with a stored RSA public/private keypair, which can be used for multi factor authentication according to the EU PSD2 standards: Possession, Knowledge, and Inherence.

- [Device Enrolment with lindorm.io](https://swimlanes.io/u/nwje5-Rpc)
- [Device Challenge with lindorm.io](https://swimlanes.io/u/Gc_YWRWum)
- [Remote Device Challenge with lindorm.io](https://swimlanes.io/u/oO2OfOlAH)

## OAuth Service
This service handles all authorization related flows in accordance with the [OpenID Connect Specifications](https://openid.net). It is built to run independently in a microservice environment, where authentication is handled by another service such as the aforementioned [Authentication Service](#authentication-service).

- [Authorization with lindorm.io](https://swimlanes.io/u/KQMGNBzbl)
- [Logout with lindorm.io](https://swimlanes.io/u/o-xTVGSml)

# License
All packages are licensed with `AGPL-3.0`.
