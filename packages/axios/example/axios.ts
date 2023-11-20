import { ConsoleLogger } from "@lindorm-io/console-logger";
import { LogLevel } from "@lindorm-io/core-logger";
import {
  Axios,
  TransformMode,
  axiosTransformRequestBodyMiddleware,
  axiosTransformRequestQueryMiddleware,
  axiosTransformResponseDataMiddleware,
} from "../src";

(async (): Promise<void> => {
  const logger = new ConsoleLogger();
  logger.addConsole(LogLevel.SILLY, { colours: true, readable: true, timestamp: true });

  const axios = new Axios(
    {
      middleware: [
        axiosTransformRequestBodyMiddleware(TransformMode.SNAKE),
        axiosTransformRequestQueryMiddleware(TransformMode.SNAKE),
        axiosTransformResponseDataMiddleware(TransformMode.CAMEL),
      ],
    },
    logger,
  );

  await axios.get("https://api.scryfall.com/bulk-data");
})();
