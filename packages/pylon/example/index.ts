import { Conduit, conduitBearerAuthMiddleware } from "@lindorm/conduit";
import { LogLevel, Logger } from "@lindorm/logger";
import { EXAMPLE_PYLON } from "./_example";

const logger = new Logger({ level: LogLevel.Silly, readable: true });

const main = async (): Promise<void> => {
  await EXAMPLE_PYLON.start();

  const conduit = new Conduit({
    baseUrl: "http://127.0.0.1:3000",
    logger,
  });

  await conduit.get("/health");
  await conduit.get("/test");

  const one = await conduit.get("/test/authorize");

  logger.info("If we're here we have a token", one.data);

  const two = await conduit.get("/authorized/route/is-authorized", {
    middleware: [conduitBearerAuthMiddleware(one.data.token.token)],
  });

  logger.info("If we're here the token should be authorized", two.data);
};

main().catch(console.error);
