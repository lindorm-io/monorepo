import { Logger } from "@lindorm/logger";
import { Conduit, conduitChangeResponseDataMiddleware } from "../src/index.js";

const main = async (): Promise<void> => {
  const logger = new Logger({
    level: "debug",
    readable: true,
  });

  const conduit = new Conduit({
    alias: "Scryfall",
    baseUrl: "https://api.scryfall.com",
    logger,
    middleware: [conduitChangeResponseDataMiddleware("camel")],
    timeout: 500,
  });

  await conduit.get("/bulk-data");
};

main().catch(console.error);
