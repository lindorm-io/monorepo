import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";

export const assertSignatureDeviceLinkMiddleware: ServerKoaMiddleware = async (ctx, next) => {
  const {
    entity: { publicKey },
    mongo: { deviceLinkRepository },
  } = ctx;

  const signature = ctx.get("signature");

  if (signature) {
    if (!publicKey) {
      throw new ServerError("Public Key not found");
    }

    const deviceLink = await deviceLinkRepository.find({ publicKeyId: publicKey.id });

    const deviceLinkId = ctx.get("x-device-link-id");

    if (deviceLink.id !== deviceLinkId) {
      throw new ClientError("Invalid signature", {
        description: "Device Link ID does not match key in signature",
        debug: { expect: deviceLink.id, actual: deviceLinkId },
      });
    }
  }

  await next();
};
