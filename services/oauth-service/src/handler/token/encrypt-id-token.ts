import { ServerError } from "@lindorm-io/errors";
import { WebKeySet } from "@lindorm-io/jwk";
import { JWE, JwtAlgorithm } from "@lindorm-io/jwt";
import { Keystore } from "@lindorm-io/keystore";
import { getKeysFromJwks } from "@lindorm-io/koa-keystore";
import { randomUUID } from "crypto";
import { Client } from "../../entity";
import { ServerKoaContext } from "../../types";

export const encryptIdToken = async (
  ctx: ServerKoaContext,
  client: Client,
  idToken: string,
): Promise<string> => {
  const { logger } = ctx;

  const keystore = new Keystore([], logger);

  if (!client.idTokenEncryption.algorithm) {
    throw new ServerError("ID Token Encryption failed", {
      description: "No encryption algorithm found",
    });
  }

  if (client.jwks.length) {
    const key = WebKeySet.fromJwk({
      alg: JwtAlgorithm.HS256,
      k: client.jwks[0],
      key_ops: ["encrypt", "decrypt"],
      kid: randomUUID(),
      kty: "oct",
      use: "enc",
    });

    keystore.addKey(key);
  } else if (client.jwksUri) {
    const keys = await getKeysFromJwks({ baseURL: client.jwksUri, path: "" }, logger);

    keystore.addKeys(keys);
  }

  const jwe = new JWE(
    {
      encryption: client.idTokenEncryption.algorithm,
      encryptionKeyAlgorithm: client.idTokenEncryption.encryptionKeyAlgorithm ?? undefined,
    },
    keystore,
    logger,
  );

  return jwe.encrypt(idToken);
};
