import { TransformMode, axiosTransformResponseDataMiddleware } from "@lindorm-io/axios";
import { ServerError } from "@lindorm-io/errors";
import { encryptJwe } from "@lindorm-io/jwt";
import { DefaultJWK, KeyJWK, KeyPair, KeyPairType } from "@lindorm-io/key-pair";
import { Client } from "../../entity";
import { ServerKoaContext } from "../../types";

type JWK = DefaultJWK & KeyJWK;

type JwkResponse = {
  keys: Array<JWK>;
};

export const encryptIdToken = async (
  ctx: ServerKoaContext,
  client: Client,
  idToken: string,
): Promise<string> => {
  const {
    axios: { axiosClient },
  } = ctx;

  let key: string | undefined;
  let keyId: string | undefined;

  if (!client.idTokenEncryption.algorithm) {
    throw new ServerError("ID Token Encryption failed", {
      description: "No encryption algorithm found",
    });
  }

  if (client.jwks.length) {
    key = client.jwks[0];
  } else if (client.jwksUri) {
    const {
      data: { keys },
    } = await axiosClient.get<JwkResponse>(client.jwksUri, {
      middleware: [axiosTransformResponseDataMiddleware(TransformMode.CAMEL)],
    });

    const rsaKeys = keys.filter((key) => key.kty === KeyPairType.RSA);

    if (!rsaKeys.length) {
      throw new ServerError("ID Token Encryption failed", {
        description: "No RSA keys found",
      });
    }

    const keyPair = KeyPair.fromJWK(rsaKeys[0]);

    if (!keyPair.publicKey) {
      throw new ServerError("ID Token Encryption failed", {
        description: "No public key found on key pair",
      });
    }

    key = keyPair.publicKey;
    keyId = keyPair.id;
  }

  if (!key) {
    throw new ServerError("ID Token Encryption failed", {
      description: "No key found",
    });
  }

  const jwe = encryptJwe({
    algorithm: client.idTokenEncryption.algorithm,
    encryptionKeyAlgorithm: client.idTokenEncryption.encryptionKeyAlgorithm || undefined,
    key,
    keyId,
    token: idToken,
  });

  return jwe;
};
