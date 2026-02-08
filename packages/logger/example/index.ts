import { LindormError } from "@lindorm/errors";
import { Logger } from "../src";

const logger = new Logger({ level: "silly", readable: true });

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

logger.info("this will be displayed with multiple extra objects", { context: "data" }, [
  { other: 123 },
  { stuff: { else: true } },
]);

logger.log({
  context: { data: "context" },
  extra: [{ extra: "extra" }],
  level: "debug",
  message: "this is a log with everything",
});

logger.log({
  context: { data: "context" },
  level: "debug",
  message: "this is a log without extra",
});

logger.log({
  level: "debug",
  message: "this is a log without context",
});

logger.log({
  message: "this is a log without level",
});

const child1 = logger.child(["logger"]);
child1.info("this is a log from child 1");

const child2 = child1.child(["child1"]);
child2.info("this is a log from child 2");

const child3 = child2.child(["extra", "stuff"]);
child3.info("this will be displayed with a scope array");

const logger2 = new Logger({ level: "info", readable: true });

logger2.info("this will not have any colour", { details: "data" });

logger2.info("data is not filtered", data);

logger.filterPath("two");

logger.info("this will be filtered", data);

logger.info("data will not be changed", { readable: data });

// -- filterKey --

console.log("\n--- filterKey ---");

const keyLogger = new Logger({ level: "silly", readable: true });

keyLogger.filterKey("password");
keyLogger.info("nested password filtered", {
  user: { credentials: { password: "super-secret" } },
});

keyLogger.filterKey(/token/i);
keyLogger.info("regex token filter", {
  accessToken: "eyJhbGciOi...",
  refreshToken: "dGhpcyBpcyBh...",
  username: "alice",
});

// -- error cause chain --

console.log("\n--- Error cause chain ---");

const rootCause = new Error("database connection refused");
const midError = new Error("query failed", { cause: rootCause });
const topError = new Error("user lookup failed", { cause: midError });

logger.error(topError);

// -- isLevelEnabled --

console.log("\n--- isLevelEnabled ---");

logger.info(`isLevelEnabled("info"): ${logger.isLevelEnabled("info")}`);
logger.info(`isLevelEnabled("silly"): ${logger.isLevelEnabled("silly")}`);

const infoOnly = new Logger({ level: "info", readable: true });
infoOnly.info(`isLevelEnabled("info"): ${infoOnly.isLevelEnabled("info")}`);
infoOnly.info(`isLevelEnabled("debug"): ${infoOnly.isLevelEnabled("debug")}`);

if (infoOnly.isLevelEnabled("debug")) {
  infoOnly.debug("this will not appear");
} else {
  infoOnly.info("skipped expensive debug computation");
}

// -- time (LoggerTimer handle) --

console.log("\n--- time (LoggerTimer handle) ---");

const syncTimer = logger.time();

let sum = 0;
for (let i = 0; i < 1_000_000; i++) sum += i;

syncTimer.info("sync-operation", { sum });

// -- time(label) / timeEnd(label) --

console.log("\n--- time(label) / timeEnd(label) ---");

logger.time("label-operation");
let product = 1;
for (let i = 1; i <= 20; i++) product *= i;
logger.timeEnd("label-operation"); // defaults to debug level

logger.time("explicit-level-op");
logger.timeEnd("explicit-level-op", "info", { product }); // explicit level with context

const asyncTimer = logger.time();
setTimeout(() => {
  asyncTimer.info("async-operation", { result: "done" });

  // child timer inherits parent logger's scope/correlation
  const timerChild = logger.child(["timerChild"]);
  const childTimer = timerChild.time();
  setTimeout(() => {
    childTimer.info("child-timed-operation", { note: "ended by child" });

    // -- level getter/setter --

    console.log("\n--- level getter/setter ---");

    const dynamicLogger = new Logger({ level: "info", readable: true });
    dynamicLogger.info(`current level: ${dynamicLogger.level}`);

    dynamicLogger.debug("this debug message will NOT appear");

    dynamicLogger.level = "debug";
    dynamicLogger.info(`level changed to: ${dynamicLogger.level}`);
    dynamicLogger.debug("this debug message WILL appear");

    dynamicLogger.level = "warn";
    dynamicLogger.info("this info message will NOT appear");
    dynamicLogger.warn("this warn message will appear");

    // child shares winston instance, so level change affects child too
    const dynamicChild = dynamicLogger.child(["dynamic"]);
    dynamicLogger.level = "silly";
    dynamicChild.silly("child can now log silly because parent changed level");

    // -- JSON output --

    console.log("\n--- JSON output ---");

    const json = new Logger({ level: "silly" });

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

    // error cause chain in JSON mode
    json.error(new Error("outer", { cause: new Error("inner cause") }));

    // time in JSON mode
    const jsonTimer = json.time();
    jsonTimer.info("json-timer", { mode: "json" });
  }, 10);
}, 20);
