# @lindorm/conduit

A powerful HTTP client with middleware support, built on top of Axios/Fetch with automatic retries, OAuth2 support, and comprehensive error handling.

## Installation

```bash
npm install @lindorm/conduit
```

## Features

- **Dual HTTP Engine Support**: Choose between Axios or Fetch implementations
- **Middleware Pipeline**: Composable middleware for request/response transformation
- **Automatic Retries**: Configurable retry strategies with exponential/linear backoff
- **OAuth2 Support**: Built-in client credentials flow with token caching
- **Response Transformation**: Automatic case conversion for requests/responses
- **Schema Validation**: Validate responses with Zod schemas
- **Comprehensive Logging**: Built-in request/response logging
- **TypeScript First**: Full TypeScript support with strict typing
- **Streaming Support**: Handle file uploads/downloads and streaming responses

## Quick Start

```typescript
import { Conduit } from "@lindorm/conduit";

const client = new Conduit({
  baseUrl: "https://api.example.com",
  timeout: 30000
});

// Simple GET request
const users = await client.get("/users");

// POST with body
const newUser = await client.post("/users", {
  body: { name: "John Doe", email: "john@example.com" }
});

// With custom headers
const data = await client.get("/protected", {
  headers: { "X-API-Key": "secret-key" }
});
```

## Configuration

### Constructor Options

```typescript
interface ConduitConfig {
  baseUrl?: string | URL;           // Base URL for all requests
  alias?: string;                   // Human-readable name for logging
  environment?: Environment;        // Environment context
  headers?: Headers;                // Default headers
  logger?: ILogger;                 // Logger instance
  middleware?: Middleware[];        // Middleware pipeline
  timeout?: number;                 // Request timeout (default: 30000ms)
  withCredentials?: boolean;        // Include credentials
  using?: ConduitUsing;            // Axios or Fetch (default: Axios)
  retryOptions?: RetryOptions;      // Retry configuration
  retryCallback?: RetryCallback;    // Custom retry logic
}
```

### Request Options

```typescript
interface RequestOptions {
  body?: any;                       // Request body
  form?: FormData;                  // FormData for multipart
  stream?: ReadableStream;          // Stream for uploads
  headers?: Headers;                // Request headers
  params?: Record<string, string>;  // URL path parameters
  query?: Record<string, any>;      // Query parameters
  expectedResponse?: ExpectedResponse; // Response type
  filename?: string;                // For downloads
  middleware?: Middleware[];        // Request-specific middleware
  retryOptions?: RetryOptions;      // Request-specific retry config
}
```

## Middleware

### Authentication

```typescript
import { 
  conduitBearerAuthMiddleware,
  conduitBasicAuthMiddleware,
  conduitClientCredentialsMiddlewareFactory 
} from "@lindorm/conduit";

// Bearer token
const bearerClient = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [conduitBearerAuthMiddleware("your-token")]
});

// Basic auth
const basicClient = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [conduitBasicAuthMiddleware("username", "password")]
});

// OAuth2 client credentials
const oauth2Middleware = await conduitClientCredentialsMiddlewareFactory({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  openIdConfigurationUri: "https://auth.example.com/.well-known/openid-configuration",
  scope: ["read", "write"]
});

const oauthClient = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [oauth2Middleware]
});
```

### Response Transformation

```typescript
import { conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { ChangeCase } from "@lindorm/case";

// Convert snake_case API responses to camelCase
const client = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [conduitChangeResponseDataMiddleware(ChangeCase.Camel)]
});

// Response: { user_name: "John" } → { userName: "John" }
```

### Request Transformation

```typescript
import { 
  conduitChangeRequestBodyMiddleware,
  conduitChangeRequestQueryMiddleware,
  conduitChangeRequestHeadersMiddleware 
} from "@lindorm/conduit";
import { ChangeCase } from "@lindorm/case";

const client = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [
    // Convert camelCase to snake_case for API
    conduitChangeRequestBodyMiddleware(ChangeCase.Snake),
    conduitChangeRequestQueryMiddleware(ChangeCase.Snake),
    conduitChangeRequestHeadersMiddleware(ChangeCase.Header)
  ]
});

// Request body: { userName: "John" } → { user_name: "John" }
```

### Schema Validation

```typescript
import { conduitSchemaMiddleware } from "@lindorm/conduit";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

const client = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [conduitSchemaMiddleware(userSchema)]
});

// Responses will be validated against the schema
```

### Custom Headers

```typescript
import { conduitHeaderMiddleware, conduitHeadersMiddleware } from "@lindorm/conduit";

// Single header
const client1 = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [conduitHeaderMiddleware("X-API-Version", "v2")]
});

// Multiple headers
const client2 = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [conduitHeadersMiddleware({
    "X-API-Version": "v2",
    "X-Client-ID": "my-app"
  })]
});
```

### Correlation and Session Tracking

```typescript
import { conduitCorrelationMiddleware, conduitSessionMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [
    conduitCorrelationMiddleware("correlation-id-123"),
    conduitSessionMiddleware("session-id-456")
  ]
});
```

## Retry Configuration

```typescript
import { RetryStrategy } from "@lindorm/retry";

const client = new Conduit({
  baseUrl: "https://api.example.com",
  retryOptions: {
    maxAttempts: 5,
    strategy: RetryStrategy.Exponential,
    baseTimeout: 250,
    maxTimeout: 10000,
    factor: 2,
    jitter: true
  }
});

// Custom retry logic
const customRetryClient = new Conduit({
  baseUrl: "https://api.example.com",
  retryCallback: (error, attempt, options) => {
    // Only retry on network errors or 5xx responses
    if (error.statusCode && error.statusCode < 500) {
      return false;
    }
    return attempt < options.maxAttempts;
  }
});
```

## Response Types

```typescript
// JSON (default)
const json = await client.get("/data");

// Text
const text = await client.get("/text", {
  expectedResponse: ExpectedResponse.Text
});

// Binary data
const blob = await client.get("/image", {
  expectedResponse: ExpectedResponse.Blob
});

// Streaming
const stream = await client.get("/large-file", {
  expectedResponse: ExpectedResponse.Stream
});

// File download
const file = await client.get("/report.pdf", {
  expectedResponse: ExpectedResponse.Blob,
  filename: "report.pdf"
});
```

## File Uploads

```typescript
// Using FormData
const formData = new FormData();
formData.append("file", fileBlob, "document.pdf");
formData.append("description", "Important document");

const response = await client.post("/upload", {
  form: formData
});

// Using streams
const fileStream = fs.createReadStream("large-file.zip");
const uploaded = await client.post("/upload-stream", {
  stream: fileStream,
  headers: {
    "Content-Type": "application/zip"
  }
});
```

## Error Handling

```typescript
import { ConduitError } from "@lindorm/conduit";

try {
  const data = await client.get("/protected");
} catch (error) {
  if (error instanceof ConduitError) {
    console.error("Status:", error.statusCode);
    console.error("Message:", error.message);
    console.error("Request ID:", error.data.request.id);
    console.error("Response:", error.data.response.data);
  }
}
```

## Advanced Usage

### Path Parameters

```typescript
// Path with parameters
const user = await client.get("/users/:id/posts/:postId", {
  params: {
    id: "123",
    postId: "456"
  }
});
// Resolves to: /users/123/posts/456
```

### Query Parameters

```typescript
const results = await client.get("/search", {
  query: {
    q: "typescript",
    limit: 10,
    offset: 0
  }
});
// Resolves to: /search?q=typescript&limit=10&offset=0
```

### Switching HTTP Engines

```typescript
import { ConduitUsing } from "@lindorm/conduit";

// Use Fetch instead of Axios
const fetchClient = new Conduit({
  baseUrl: "https://api.example.com",
  using: ConduitUsing.Fetch
});
```

### Custom Middleware

```typescript
const timingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`Request took ${duration}ms`);
};

const client = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [timingMiddleware]
});
```

### With Logger

```typescript
import { Logger } from "@lindorm/logger";

const logger = new Logger();

const client = new Conduit({
  baseUrl: "https://api.example.com",
  logger,
  alias: "ExampleAPI"
});

// All requests and responses will be logged
```

## Examples

### API Client with Full Configuration

```typescript
import { Conduit } from "@lindorm/conduit";
import { Logger, LogLevel } from "@lindorm/logger";
import { ChangeCase } from "@lindorm/case";
import { RetryStrategy } from "@lindorm/retry";

const logger = new Logger({ level: LogLevel.Debug });

const apiClient = new Conduit({
  alias: "MyAPI",
  baseUrl: "https://api.example.com",
  logger,
  timeout: 15000,
  headers: {
    "X-Client-Version": "1.0.0"
  },
  middleware: [
    conduitBearerAuthMiddleware(process.env.API_TOKEN),
    conduitChangeRequestBodyMiddleware(ChangeCase.Snake),
    conduitChangeResponseDataMiddleware(ChangeCase.Camel)
  ],
  retryOptions: {
    maxAttempts: 3,
    strategy: RetryStrategy.Exponential
  }
});

// Use the configured client
const users = await apiClient.get("/v1/users");
const newUser = await apiClient.post("/v1/users", {
  body: { firstName: "John", lastName: "Doe" }
});
```

### OAuth2 Protected API

```typescript
const oauthMiddleware = await conduitClientCredentialsMiddlewareFactory({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  openIdConfigurationUri: "https://auth.example.com/.well-known/openid-configuration",
  scope: ["api:read", "api:write"],
  audience: "https://api.example.com"
});

const protectedClient = new Conduit({
  baseUrl: "https://api.example.com",
  middleware: [oauthMiddleware()]
});

// Token is automatically fetched and refreshed
const data = await protectedClient.get("/protected-resource");
```

## License

AGPL-3.0-or-later
