import { Amphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger, LogLevel } from "@lindorm/logger";
import { sleep } from "@lindorm/utils";
import { AmphoraWorker, Environment, Pylon } from "../src";

const logger = new Logger({ level: LogLevel.Silly, readable: true });

const amphora = new Amphora({
  issuer: "http://test.lindorm.io",
  logger,
  external: [
    {
      issuer: "http://external.lindorm.io",
      openIdConfigurationUri: "http://localhost:3001/.well-known/openid-configuration",
    },
  ],
});

amphora.add(
  KryptosKit.generate.auto({
    algorithm: "ES256",
    issuer: "http://test.lindorm.io",
  }),
);

const worker = new AmphoraWorker({
  amphora,
  logger,
  interval: "1m",
});

const pylon = new Pylon({
  amphora,
  logger,

  environment: Environment.Test,
  issuer: "http://test.lindorm.io",
  name: "@lindorm/pylon",
  port: 3000,
  version: "0.0.0",
  workers: [worker],
});

// creating what's needed for the pretend external server

const externalAmphora = new Amphora({
  issuer: "http://external.lindorm.io",
  logger,
});

externalAmphora.add(
  KryptosKit.generate.auto({
    algorithm: "RS256",
    issuer: "http://external.lindorm.io",
    jwksUri: "http://localhost:3001/.well-known/jwks.json",
  }),
);

const externalPylon = new Pylon({
  amphora: externalAmphora,
  logger,

  environment: Environment.Test,
  issuer: "http://external.lindorm.io",
  name: "pretend-external-server",
  openIdConfiguration: {
    jwksUri: "http://localhost:3001/.well-known/jwks.json",
  },
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
};

main().catch(console.error);
