import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";

export const assertSignatureClientMiddleware: ServerKoaMiddleware = async (ctx, next) => {
  const {
    entity: { publicKey },
    mongo: { clientRepository },
    token: {
      bearerToken: { subject },
    },
  } = ctx;

  const signature = ctx.get("signature");

  if (signature) {
    if (!publicKey) {
      throw new ServerError("Public Key not found");
    }

    const client = await clientRepository.find({ publicKeyId: publicKey.id });

    if (client.id !== subject) {
      throw new ClientError("Invalid signature", {
        description: "Client ID does not match key in signature",
        debug: { expect: client.id, actual: subject },
      });
    }
  }

  await next();
};
