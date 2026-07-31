import { Amphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger } from "@lindorm/logger";
import { sleep } from "@lindorm/utils";
import { Pylon } from "../src/index.js";

const logger = new Logger({ level: "silly", readable: true });

const amphora = new Amphora({
  domain: "http://test.lindorm.io",
  logger,
  external: [
    {
      issuer: "http://external.lindorm.io",
      jwksUri: "http://localhost:3001/.well-known/jwks.json",
    },
  ],
});

amphora.add(
  KryptosKit.generate.auto({
    algorithm: "ES256",
    issuer: "http://test.lindorm.io",
    publish: true,
  }),
);

const pylon = new Pylon({
  amphora,
  logger,

  environment: "test",
  name: "@lindorm/pylon",
  port: 3000,
  version: "0.0.0",
});

// creating what's needed for the pretend external server

const externalAmphora = new Amphora({
  domain: "http://external.lindorm.io",
  logger,
});

externalAmphora.add(
  KryptosKit.generate.auto({
    algorithm: "RS256",
    issuer: "http://external.lindorm.io",
    publish: true,
    jwksUri: "http://localhost:3001/.well-known/jwks.json",
  }),
);

const externalPylon = new Pylon({
  amphora: externalAmphora,
  logger,

  environment: "test",
  name: "pretend-external-server",
  port: 3001,
  version: "0.0.0",
});

const main = async (): Promise<void> => {
  await externalPylon.start();
  await pylon.start();

  await sleep(1000);

  const conduit = new Conduit({ logger });
  await conduit.get("http://localhost:3001/.well-known/jwks.json");
  await conduit.get("http://localhost:3000/.well-known/jwks.json");

  await sleep(1000);

  logger.info("Amphora vault", { vault: amphora.vault });

  await pylon.stop();
  await externalPylon.stop();
};

main().catch(console.error);
