import { LindormError } from "@lindorm/errors";
import { Logger, LogLevel } from "../src";

const logger = new Logger({ level: LogLevel.Silly, readable: true });

const child1 = logger.child(["logger"]);
const child2 = child1.child(["child1"]);

const data = { one: 1, two: "two" };

logger.silly("this is a silly log");

logger.debug("this is a debug log");

logger.verbose("this is a verbose log");

logger.info("this is an info log");

logger.warn("this is a warning");

logger.error("this is a simple error message", new Error("simple error message"));

logger.error(new Error("this is an error message"));

logger.error(
  "this is an error with data",
  new LindormError("lindorm error message", {
    code: "error_code",
    data: { publicData: true },
    debug: { debugData: "value" },
    error: new LindormError("original error", {
      title: "original error title",
    }),
  }),
);

logger.info(
  "this will be displayed with multiple details objects",
  { details: "data" },
  { other: 123 },
  { stuff: { else: true } },
);

logger.context(["extra", "stuff"]);

logger.info("this will be displayed with a context object");

child1.info("this is a log from child 1");

child2.info("this is a log from child 2");

const logger2 = new Logger({ level: LogLevel.Info, readable: true });

logger2.info("this will not have any colour", { details: "data" });

logger2.info("data is not changed", data);

logger.filter("two");

logger.info("this will be filtered", data);

const logger3 = new Logger({ level: LogLevel.Info });

logger.session({ id: "session-id" });

logger3.info("this is a log from session logger with data", data);

logger3.info("this is a log from session");

const json = new Logger({ level: LogLevel.Silly });

json.info("this is a log from json");

json.error("this is an error with data", new Error("basic error message"));

json.error(
  "this is an error with data",
  new LindormError("lindorm error message", {
    code: "error_code",
    data: { publicData: true },
    debug: { debugData: "value" },
    error: new LindormError("original error", {
      title: "original error title",
    }),
  }),
);
