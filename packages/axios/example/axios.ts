import { Axios, axiosRequestLoggerMiddleware, axiosTransformBodyCaseMiddleware } from "../src";
import { ConsoleLogger } from "@lindorm-io/console-logger";
import { LogLevel } from "@lindorm-io/core-logger";

(async () => {
  const logger = new ConsoleLogger();
  logger.addConsole(LogLevel.SILLY, { colours: true, readable: true, timestamp: true });

  const axios = new Axios({
    middleware: [axiosRequestLoggerMiddleware(logger), axiosTransformBodyCaseMiddleware()],
  });

  const { request, ...result } = await axios.get("https://api.scryfall.com/bulk-data");

  logger.info("Result", { result });
})();
