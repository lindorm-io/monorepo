# @lindorm-io/core-logger

Simple core logger for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/core-logger
```

## Setup

```typescript
import { ConsoleLogger, LogLevel } from "@lindorm-io/core-logger";

const logger = new ConsoleLogger();

logger.addConsole(LogLevel.INFO, { readable: true, colours: true, timestamp: true });
```

## Usage

### Logging

The logger accepts a message as first argument, and an object or an error as second (optional) argument.

```typescript
logger.info("this is the logger message", {
  this_is: "the logger details object"
});

logger.error("this is the message", new Error("with an error and error stack"));
```

### Add a child logger

You can create child logger with further context data to easily separate where the message was sent.

```typescript
export const childLogger = logger.createChildLogger([
  "context1",
  "context2",
  "context3",
]);
```

### Add a session logger

You can create a child logger with specific session data to easily separate log rows for different sessions.

```typescript
export const sessionLogger = logger.createSessionLogger({
  session: "object",
  request_id: "id",
});
```

### Add a filter

You can hide sensitive data from logs by adding a filter with object path.

```typescript
logger.addFilter([
  "req.body.sensitive",
]);

logger.info("MESSAGE", req);
// MESSAGE { req: { body: { sensitive: "[Filtered]", } } }
```
