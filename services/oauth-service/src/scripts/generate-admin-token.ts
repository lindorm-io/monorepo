import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { Keystore } from "@lindorm-io/key-pair";
import { SubjectHint } from "../common";
import { TokenIssuer } from "@lindorm-io/jwt";
import { TokenType } from "../enum";
import { configuration } from "../server/configuration";
import { randomUUID } from "crypto";
import { redisConnection } from "../instance";
import { winston } from "../server/logger";

(async (): Promise<void> => {
  try {
    const issuer = configuration.server.host;
    await redisConnection.waitForConnection();
    const cache = new KeyPairCache({ client: redisConnection.client(), logger: winston });
    const keys = await cache.findMany({});
    const keystore = new Keystore({ keys });
    const jwt = new TokenIssuer({ issuer, keystore, logger: winston });

    const { token } = jwt.sign({
      audiences: [],
      authContextClass: ["loa_4"],
      authMethodsReference: ["generate_admin_token"],
      expiry: "60 days",
      levelOfAssurance: 4,
      permissions: [],
      scopes: [],
      sessionId: randomUUID(),
      subject: randomUUID(),
      subjectHint: SubjectHint.IDENTITY,
      type: TokenType.ACCESS,
    });

    winston.info("Generated token", { token });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
