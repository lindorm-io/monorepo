import { ChangeCase } from "@lindorm/case";
import { LindormLogger, LogLevel } from "@lindorm/logger";
import { Conduit, conduitChangeResponseDataMiddleware } from "../src";

const main = async (): Promise<void> => {
  const logger = new LindormLogger({
    level: LogLevel.Debug,
    readable: true,
  });

  const conduit = new Conduit({
    alias: "Scryfall",
    baseUrl: "https://api.scryfall.com",
    logger,
    middleware: [conduitChangeResponseDataMiddleware(ChangeCase.Camel)],
    timeout: 500,
  });

  await conduit.get("/bulk-data");
};

main().catch(console.error);
