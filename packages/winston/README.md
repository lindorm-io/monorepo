# @lindorm-io/winston

Simple winston logger for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/winston
```

## Setup

```typescript
import { WinstonLogger, LogLevel } from "@lindorm-io/winston";

const pkg = fs.readFileSync(path.join(__dirname, "..", "package.json"), { encoding: "utf8" });
const { name, version } = JSON.parse(pkg);

const winston = new WinstonLogger({
  context: "logger-context",
  packageName: name,
  packageVersion: version,
});

winston.addConsole(LogLevel.INFO);
winston.addTail(LogLevel.DEBUG);
winston.addFileTransport(LogLevel.ERROR);
winston.addFileTransport(LogLevel.SILLY);

export default winston;
```

## Usage

### Logging

The logger accepts a message as first argument, and an object or an error as second (optional) argument.

```JavaScript
winston.info("this is the logger message", {
  this_is: "the logger details object"
});
winston.error("this is the message", new Error("with an error and error stack"));
```

### Add a child logger

You can create child logger with further context data to easily separate where the message was sent.

```JavaScript
export const childLogger = winston.createChildLogger([
  "context1",
  "context2",
  "context3",
]);
```

### Add a session logger

You can create a child logger with specific session data to easily separate log rows for different sessions.

```JavaScript
export const sessionLogger = winston.createSessionLogger({
  session: "object",
  request_id: "id",
});
```

### Add a filter

You can hide sensitive data from logs by adding a filter with object path.

```JavaScript
winston.addFilter([
  "req.body.sensitive",
]);
winston.info("MESSAGE", req);
// MESSAGE { req: { body: { sensitive: "[Filtered]", } } }
```
