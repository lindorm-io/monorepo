import { ConsoleLogger } from "@lindorm-io/console-logger";
import { LogLevel } from "@lindorm-io/core-logger";
import { Axios, axiosRequestLoggerMiddleware, axiosTransformBodyCaseMiddleware } from "../src";

(async (): Promise<void> => {
  const logger = new ConsoleLogger();
  logger.addConsole(LogLevel.SILLY, { colours: true, readable: true, timestamp: true });

  const axios = new Axios({
    middleware: [axiosRequestLoggerMiddleware(logger), axiosTransformBodyCaseMiddleware()],
  });

  const { request, ...result } = await axios.get("https://api.scryfall.com/bulk-data");

  logger.info("Result", { result });
})();
