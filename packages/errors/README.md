# @lindorm/errors

Structured error handling system with HTTP status codes, error chaining, and rich metadata support.

## Installation

```bash
npm install @lindorm/errors
```

## Features

- **Structured Errors**: Rich error objects with consistent properties
- **HTTP Status Codes**: Built-in client (4xx) and server (5xx) error classes
- **Error Chaining**: Wrap and preserve error information through application layers
- **Unique IDs**: Every error gets a UUID for tracking
- **Metadata Support**: Separate user-facing and debug data
- **Type-Safe**: Full TypeScript support
- **JSON Serialization**: Clean JSON output for APIs and logging

## Quick Start

```typescript
import { LindormError, ClientError, ServerError } from "@lindorm/errors";

// Basic error
throw new LindormError("Something went wrong");

// Client error with status code
throw new ClientError("Invalid request", {
  status: ClientError.Status.BadRequest,
  code: "VALIDATION_ERROR",
  data: { field: "email", value: "invalid-email" }
});

// Server error with debugging info
throw new ServerError("Database connection failed", {
  status: ServerError.Status.ServiceUnavailable,
  debug: { host: "localhost", port: 5432 }
});
```

## Error Classes

### LindormError

The base error class that extends JavaScript's native `Error`.

```typescript
class LindormError extends Error {
  readonly id: string;              // Unique error ID (UUID)
  readonly code: string | null;     // Error code for categorization
  readonly data: Dict;              // User-facing data
  readonly debug: Dict;             // Debug information
  readonly details: string | null;  // Detailed description
  readonly errors: string[];        // Error message chain
  readonly status: number;          // HTTP status code (default: 500)
  readonly support: string | null;  // Support contact info
  readonly title: string | null;    // Error title
}
```

#### Constructor Options

```typescript
interface LindormErrorOptions {
  id?: string;          // Custom ID (auto-generated if not provided)
  code?: string;        // Error code
  data?: Dict;          // User-facing data
  debug?: Dict;         // Debug data
  details?: string;     // Detailed description
  error?: Error;        // Error to wrap
  status?: number;      // HTTP status code
  support?: string;     // Support information
  title?: string;       // Error title
}
```

### ClientError

Extends `LindormError` for client-side errors (4xx status codes).

```typescript
// Using predefined status
throw new ClientError("Not found", {
  status: ClientError.Status.NotFound
});

// Available status codes
ClientError.Status.BadRequest           // 400
ClientError.Status.Unauthorized         // 401
ClientError.Status.PaymentRequired      // 402
ClientError.Status.Forbidden            // 403
ClientError.Status.NotFound             // 404
ClientError.Status.MethodNotAllowed     // 405
ClientError.Status.NotAcceptable        // 406
ClientError.Status.ProxyAuthRequired    // 407
ClientError.Status.RequestTimeout       // 408
ClientError.Status.Conflict             // 409
ClientError.Status.Gone                 // 410
ClientError.Status.LengthRequired       // 411
ClientError.Status.PreconditionFailed   // 412
ClientError.Status.PayloadTooLarge      // 413
ClientError.Status.RequestUriTooLong    // 414
ClientError.Status.UnsupportedMedia     // 415
ClientError.Status.RangeNotSatisfiable  // 416
ClientError.Status.ExpectationFailed    // 417
ClientError.Status.ImATeapot            // 418
ClientError.Status.MisdirectedRequest   // 421
ClientError.Status.UnprocessableEntity  // 422
ClientError.Status.Locked               // 423
ClientError.Status.FailedDependency     // 424
ClientError.Status.UpgradeRequired      // 426
ClientError.Status.PreconditionRequired // 428
ClientError.Status.TooManyRequests      // 429
ClientError.Status.HeaderFieldsTooLarge // 431
ClientError.Status.ConnectionClosed     // 444
ClientError.Status.LegallyUnavailable   // 451
ClientError.Status.ClientClosedRequest  // 499
```

### ServerError

Extends `LindormError` for server-side errors (5xx status codes).

```typescript
// Using predefined status
throw new ServerError("Service unavailable", {
  status: ServerError.Status.ServiceUnavailable
});

// Available status codes
ServerError.Status.InternalServerError  // 500
ServerError.Status.NotImplemented       // 501
ServerError.Status.BadGateway           // 502
ServerError.Status.ServiceUnavailable   // 503
ServerError.Status.GatewayTimeout       // 504
ServerError.Status.HttpVersionNotSupported // 505
ServerError.Status.VariantAlsoNegotiates // 506
ServerError.Status.InsufficientStorage  // 507
ServerError.Status.LoopDetected         // 508
ServerError.Status.NotExtended          // 510
ServerError.Status.NetworkAuthRequired  // 511
ServerError.Status.NetworkTimeout       // 599
```

## Usage Patterns

### Basic Error Handling

```typescript
import { LindormError } from "@lindorm/errors";

function processData(data: unknown): void {
  if (!data) {
    throw new LindormError("No data provided", {
      code: "NO_DATA",
      details: "The function requires data to process"
    });
  }
  
  // Process data...
}

try {
  processData(null);
} catch (error) {
  if (error instanceof LindormError) {
    console.error(`Error ${error.id}: ${error.message}`);
    console.error(`Code: ${error.code}`);
  }
}
```

### Error Wrapping

Preserve error context through application layers:

```typescript
import { LindormError, ServerError } from "@lindorm/errors";

async function fetchUser(id: string) {
  try {
    return await database.query(`SELECT * FROM users WHERE id = ?`, [id]);
  } catch (error) {
    throw new ServerError("Failed to fetch user", {
      error,  // Original error is wrapped
      code: "DB_QUERY_FAILED",
      data: { userId: id },
      debug: { query: "SELECT * FROM users", params: [id] }
    });
  }
}

async function getUser(id: string) {
  try {
    const user = await fetchUser(id);
    if (!user) {
      throw new ClientError("User not found", {
        status: ClientError.Status.NotFound,
        code: "USER_NOT_FOUND",
        data: { userId: id }
      });
    }
    return user;
  } catch (error) {
    throw new LindormError("Failed to get user", {
      error,  // Wraps the previous error
      code: "GET_USER_FAILED"
    });
  }
}
```

### API Error Responses

```typescript
import { ClientError, ServerError } from "@lindorm/errors";
import express from "express";

const app = express();

// Route handler
app.post("/api/users", async (req, res, next) => {
  try {
    if (!req.body.email) {
      throw new ClientError("Email is required", {
        status: ClientError.Status.BadRequest,
        code: "MISSING_EMAIL",
        data: { field: "email" },
        details: "Please provide a valid email address"
      });
    }
    
    // Create user...
  } catch (error) {
    next(error);
  }
});

// Error middleware
app.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof LindormError) {
    res.status(error.status).json(error.toJSON());
  } else {
    const serverError = new ServerError("Internal server error", {
      error,
      debug: { 
        path: req.path,
        method: req.method
      }
    });
    res.status(500).json(serverError.toJSON());
  }
});
```

### Validation Errors

```typescript
import { ClientError } from "@lindorm/errors";

interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

function validateUser(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.push({
      field: "email",
      message: "Invalid email format",
      value: data.email
    });
  }
  
  if (!data.password || data.password.length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters"
    });
  }
  
  return errors;
}

function createUser(data: any) {
  const validationErrors = validateUser(data);
  
  if (validationErrors.length > 0) {
    throw new ClientError("Validation failed", {
      status: ClientError.Status.BadRequest,
      code: "VALIDATION_FAILED",
      data: { errors: validationErrors },
      details: "Please fix the validation errors and try again"
    });
  }
  
  // Create user...
}
```

### Error Logging

```typescript
import { LindormError } from "@lindorm/errors";

function logError(error: LindormError, logger: any): void {
  // Log user-facing information
  logger.error({
    id: error.id,
    message: error.message,
    code: error.code,
    status: error.status,
    data: error.data,
    errors: error.errors
  });
  
  // Log debug information separately (could go to different log level)
  if (Object.keys(error.debug).length > 0) {
    logger.debug({
      errorId: error.id,
      debug: error.debug,
      stack: error.stack
    });
  }
}
```

## Advanced Features

### Error Chaining

The `errors` array maintains a chain of error messages:

```typescript
try {
  try {
    try {
      throw new Error("Database connection failed");
    } catch (e) {
      throw new ServerError("Query failed", { error: e });
    }
  } catch (e) {
    throw new LindormError("Operation failed", { error: e });
  }
} catch (e) {
  console.log(e.errors);
  // ["Database connection failed", "Query failed", "Operation failed"]
}
```

### Custom Error Classes

Extend the base classes for domain-specific errors:

```typescript
export class AuthenticationError extends ClientError {
  constructor(message: string, options: LindormErrorOptions = {}) {
    super(message, {
      ...options,
      status: ClientError.Status.Unauthorized,
      code: options.code || "AUTH_FAILED",
      support: "Contact support for authentication issues"
    });
  }
}

export class RateLimitError extends ClientError {
  constructor(limit: number, window: string, options: LindormErrorOptions = {}) {
    super("Rate limit exceeded", {
      ...options,
      status: ClientError.Status.TooManyRequests,
      code: "RATE_LIMIT_EXCEEDED",
      data: {
        ...options.data,
        limit,
        window,
        retryAfter: 60
      }
    });
  }
}

export class DatabaseError extends ServerError {
  constructor(operation: string, options: LindormErrorOptions = {}) {
    super(`Database ${operation} failed`, {
      ...options,
      code: `DB_${operation.toUpperCase()}_FAILED`,
      status: ServerError.Status.ServiceUnavailable
    });
  }
}
```

### Error Serialization

Errors serialize cleanly to JSON:

```typescript
const error = new ClientError("Invalid input", {
  status: ClientError.Status.BadRequest,
  code: "INVALID_INPUT",
  data: { field: "username" },
  debug: { validation: "regex_failed" },
  details: "Username must be alphanumeric"
});

console.log(JSON.stringify(error, null, 2));
// {
//   "id": "123e4567-e89b-12d3-a456-426614174000",
//   "code": "INVALID_INPUT",
//   "data": { "field": "username" },
//   "debug": { "validation": "regex_failed" },
//   "details": "Username must be alphanumeric",
//   "errors": [],
//   "message": "Invalid input",
//   "name": "ClientError",
//   "stack": "...",
//   "status": 400,
//   "support": null,
//   "title": "Bad Request"
// }
```

### Integration with Express

```typescript
import { LindormError, ClientError, ServerError } from "@lindorm/errors";
import express from "express";

const app = express();

// Async error wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
app.get("/api/users/:id", asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  
  if (!user) {
    throw new ClientError("User not found", {
      status: ClientError.Status.NotFound,
      code: "USER_NOT_FOUND",
      data: { userId: req.params.id }
    });
  }
  
  res.json(user);
}));

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  let error: LindormError;
  
  if (err instanceof LindormError) {
    error = err;
  } else {
    error = new ServerError("An unexpected error occurred", {
      error: err,
      debug: {
        url: req.url,
        method: req.method,
        headers: req.headers
      }
    });
  }
  
  // Log the error
  console.error({
    id: error.id,
    message: error.message,
    code: error.code,
    debug: error.debug,
    stack: error.stack
  });
  
  // Send response
  res.status(error.status).json({
    error: {
      id: error.id,
      code: error.code,
      message: error.message,
      details: error.details,
      data: error.data,
      support: error.support
    }
  });
});
```

## Best Practices

1. **Use Specific Error Classes**: Use `ClientError` for user mistakes and `ServerError` for system failures
2. **Include Error Codes**: Always provide a `code` for programmatic error handling
3. **Separate Data and Debug**: Put user-facing info in `data`, internal info in `debug`
4. **Wrap Original Errors**: Always pass the original error when wrapping
5. **Add Context**: Include relevant context in `data` or `debug`
6. **Use Appropriate Status Codes**: Choose the most specific HTTP status code
7. **Provide Support Info**: Add support contact for critical errors
8. **Log Error IDs**: Always log the error ID for tracking

## Error Recovery

```typescript
async function resilientOperation() {
  try {
    return await primaryOperation();
  } catch (error) {
    if (error instanceof ServerError && 
        error.status === ServerError.Status.ServiceUnavailable) {
      // Try fallback
      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        throw new ServerError("All operations failed", {
          error: fallbackError,
          code: "OPERATION_FAILED",
          data: {
            primary: error.id,
            fallback: fallbackError.id
          }
        });
      }
    }
    throw error;
  }
}
```

## License

AGPL-3.0-or-later
