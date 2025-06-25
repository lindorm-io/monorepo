# @lindorm/config

Type-safe configuration management with environment variable overrides, YAML file support, and Zod schema validation.

## Installation

```bash
npm install @lindorm/config
```

## Features

- **Type-Safe Configuration**: Full TypeScript support with Zod schema validation
- **Multiple Configuration Sources**: YAML files, environment variables, and NODE_CONFIG
- **Automatic Type Coercion**: Converts string values to correct types (numbers, booleans, arrays, objects)
- **Environment Variable Overrides**: Override any config value with environment variables
- **Case Conversion**: Automatic conversion between snake_case (files/env) and camelCase (code)
- **Environment-Specific Config**: Load different configurations based on NODE_ENV
- **CLI Tool**: Convert local config files to NODE_CONFIG environment variable
- **NPM Package Info**: Automatically includes package name and version

## Quick Start

```typescript
import { configuration } from "@lindorm/config";
import { z } from "zod";

// Define your configuration schema
const config = configuration({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default("localhost"),
  }),
  database: z.object({
    url: z.string(),
    poolSize: z.number().default(10),
  }),
  features: z.array(z.string()).default([]),
  isProduction: z.boolean().default(false),
});

// Use your typed configuration
console.log(config.server.port); // number
console.log(config.database.url); // string
console.log(config.npm.package.name); // automatically added
```

## Configuration Sources

Configuration is loaded and merged from multiple sources in this order:

1. **YAML Configuration Files** (`config/` directory)
2. **Environment Variables** (automatic override)
3. **NODE_CONFIG** environment variable (JSON object)
4. **NPM Package Information** (name and version)

### 1. YAML Configuration Files

Create a `config/` directory in your project root with environment-specific YAML files:

```yaml
# config/default.yml
server:
  port: 3000
  host: localhost

database:
  url: postgresql://localhost/myapp
  pool_size: 10

features:
  - feature1
  - feature2

is_production: false
```

```yaml
# config/production.yml
server:
  port: 8080
  host: 0.0.0.0

database:
  pool_size: 50

is_production: true
```

Files are loaded based on NODE_ENV:
- `default.yml` - Always loaded first
- `{NODE_ENV}.yml` - Environment-specific overrides (e.g., `production.yml`)

### 2. Environment Variables

Override any configuration value using environment variables. The package automatically converts between naming conventions:

```bash
# Override server.port
SERVER_PORT=8080

# Override database.url
DATABASE_URL=postgresql://prod-server/myapp

# Override nested values
DATABASE_POOL_SIZE=50

# Arrays (JSON format)
FEATURES='["feature1", "feature2", "feature3"]'

# Booleans
IS_PRODUCTION=true
```

**Naming Convention**: 
- Nested keys are flattened with underscores
- camelCase becomes snake_case
- All uppercase for environment variables

Examples:
- `server.port` → `SERVER_PORT`
- `database.poolSize` → `DATABASE_POOL_SIZE`
- `nested.some.deepValue` → `NESTED_SOME_DEEP_VALUE`

### 3. NODE_CONFIG

Pass configuration as a JSON string via NODE_CONFIG environment variable:

```bash
NODE_CONFIG='{"server":{"port":9000},"features":["feat1","feat2"]}'
```

### 4. .env Files

The package automatically loads `.env` files using `@dotenvx/dotenvx`:

```bash
# .env
DATABASE_URL=postgresql://localhost/myapp
SERVER_PORT=3000

# .env.production
DATABASE_URL=postgresql://prod-server/myapp
SERVER_PORT=8080
```

Environment-specific `.env` files are loaded based on NODE_ENV:
- `.env` - Always loaded
- `.env.{NODE_ENV}` - Environment-specific overrides

## Advanced Usage

### Complex Schema with Defaults

```typescript
import { configuration } from "@lindorm/config";
import { z } from "zod";

const config = configuration({
  app: z.object({
    name: z.string(),
    version: z.string().optional(),
    environment: z.enum(["development", "staging", "production"]),
  }),
  
  server: z.object({
    port: z.number().min(1).max(65535),
    host: z.string().ip(), // IP address validation
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string().url()).default([]),
    }),
  }),
  
  database: z.object({
    primary: z.object({
      host: z.string(),
      port: z.number().default(5432),
      name: z.string(),
      user: z.string(),
      password: z.string(),
      ssl: z.boolean().default(false),
    }),
    replica: z.object({
      host: z.string(),
      port: z.number(),
    }).optional(),
  }),
  
  redis: z.object({
    url: z.string().url(),
    ttl: z.number().default(3600),
  }),
  
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    format: z.enum(["json", "pretty"]).default("json"),
  }),
  
  features: z.record(z.boolean()).default({}),
});
```

### Using the Config Object

```typescript
// Type-safe access to configuration
if (config.server.cors.enabled) {
  app.use(cors({ origins: config.server.cors.origins }));
}

// Database connection
const dbConfig = {
  host: config.database.primary.host,
  port: config.database.primary.port,
  database: config.database.primary.name,
  user: config.database.primary.user,
  password: config.database.primary.password,
  ssl: config.database.primary.ssl,
};

// Feature flags
if (config.features.newDashboard) {
  app.use("/dashboard", newDashboardRouter);
}

// Logging configuration
logger.setLevel(config.logging.level);
```

### Working with Arrays and Objects

Environment variables support JSON format for complex types:

```bash
# Array of strings
CORS_ORIGINS='["https://app.example.com", "https://admin.example.com"]'

# Object
FEATURES='{"newDashboard": true, "betaApi": false}'

# Array of objects
SERVERS='[{"host": "server1.com", "port": 8080}, {"host": "server2.com", "port": 8081}]'
```

## CLI Tool

The package includes a CLI tool for working with configuration:

### Convert Config to NODE_CONFIG

```bash
# Create a .node_config file (JSON, YAML, or YML)
echo '{"server": {"port": 9000}}' > .node_config

# Generate NODE_CONFIG environment variable
npx config node_config
# Output: NODE_CONFIG={"server":{"port":9000}}

# Use in scripts
export $(npx config node_config)
```

This is useful for:
- Docker containers
- CI/CD pipelines
- Deployment scripts

## Best Practices

### 1. Schema Definition

Define your schema in a separate file for reusability:

```typescript
// config/schema.ts
import { z } from "zod";

export const configSchema = {
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default("localhost"),
  }),
  // ... rest of schema
};

// config/index.ts
import { configuration } from "@lindorm/config";
import { configSchema } from "./schema";

export const config = configuration(configSchema);
```

### 2. Environment-Specific Defaults

Use YAML files for environment-specific defaults:

```yaml
# config/default.yml
logging:
  level: debug
  format: pretty

# config/production.yml  
logging:
  level: info
  format: json
```

### 3. Secret Management

Never commit secrets to config files. Use environment variables:

```yaml
# config/default.yml
database:
  host: localhost
  port: 5432
  name: myapp
  # DON'T put passwords here
```

```bash
# .env (add to .gitignore)
DATABASE_USER=myuser
DATABASE_PASSWORD=secret123
```

### 4. Validation

Use Zod's features for comprehensive validation:

```typescript
const config = configuration({
  email: z.string().email(),
  port: z.number().min(1).max(65535),
  url: z.string().url(),
  apiKey: z.string().min(32),
  retryAttempts: z.number().int().positive().max(10),
});
```

## Automatic Type Coercion

The package automatically converts string values to the correct types:

| Zod Type | Input | Output |
|----------|-------|--------|
| z.number() | "123" | 123 |
| z.boolean() | "true" | true |
| z.array() | '["a","b"]' | ["a", "b"] |
| z.object() | '{"a":1}' | { a: 1 } |
| z.bigint() | "9007199254740991" | 9007199254740991n |
| z.date() | "2023-01-01" | Date object |

## NPM Package Information

The configuration automatically includes package information:

```typescript
const config = configuration({ /* your schema */ });

console.log(config.npm.package.name);    // from package.json
console.log(config.npm.package.version); // from package.json
```

## Error Handling

Configuration errors are thrown during initialization:

```typescript
try {
  const config = configuration({
    required: z.string(), // No default
  });
} catch (error) {
  console.error("Configuration error:", error);
  // Error will include details about missing required fields
}
```

## Testing

For testing, you can override configuration using NODE_ENV and environment variables:

```typescript
// test/setup.ts
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://localhost/test";
process.env.REDIS_URL = "redis://localhost:6379/1";
```

Or create a `config/test.yml`:

```yaml
database:
  url: postgresql://localhost/test
  
redis:
  url: redis://localhost:6379/1
  
logging:
  level: error  # Reduce noise in tests
```

## License

AGPL-3.0-or-later
