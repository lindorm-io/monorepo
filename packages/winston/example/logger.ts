import { LogLevel } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { WinstonLogger } from "../src";

const logger = new WinstonLogger();

logger.addConsole(LogLevel.INFO, { colours: true, readable: true, timestamp: true });

const child1 = logger.createChildLogger(["logger"]);
const child2 = child1.createChildLogger(["child1"]);

const data = { one: 1, two: "two" };

logger.verbose("this will be hidden because log level is info");

logger.info("this will be displayed");

logger.warn("this will be displayed as a warning");

logger.error("this is a simple error message", new Error("simple error message"));

logger.error(
  "this is an error with data",
  new LindormError("lindorm error message", {
    code: "error_code",
    data: { publicData: true },
    debug: { debugData: "value" },
    description: "error description",
    error: new LindormError("original error", {
      title: "original error title",
    }),
  }),
);

logger.info(
  "this will be displayed with multiple details objects",
  { details: "data" },
  undefined,
  { other: 123 },
  null,
  { stuff: { else: true } },
  undefined,
);

logger.addContext(["extra", "stuff"]);

logger.info("this will be displayed with a context object");

child1.info("this is a log from child 1");

child2.info("this is a log from child 2");

const logger2 = new WinstonLogger();

logger2.addConsole(LogLevel.INFO, { readable: true, colours: false });

logger2.info("this will not have any colour", { details: "data" });

logger2.info("data is not changed", data);

logger.setFilter("two");

logger.info("this will be filtered", data);

logger.deleteFilter("two");

logger.info("this will not be filtered", data);

logger2.info("this will not be filtered", data);

const logger3 = new WinstonLogger();

logger3.addConsole(LogLevel.INFO);

const session = logger.createSessionLogger({ id: "session-id" });

session.info("this is a log from session logger with data", data);

session.info("this is a log from session");
