import { Axios } from "../src";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { axiosTransformBodyCaseMiddleware } from "../src";

(async () => {
  const logger = new Logger();
  logger.addConsole(LogLevel.SILLY, { colours: true, readable: true, timestamp: true });

  const axios = new Axios({ middleware: [axiosTransformBodyCaseMiddleware()] }, logger);

  const { request, ...result } = await axios.get("https://api.scryfall.com/bulk-data");

  logger.info("Result", { result });
})();
