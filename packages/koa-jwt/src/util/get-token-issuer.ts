import { DefaultLindormJwtContext } from "../types";
import { JWT } from "@lindorm-io/jwt";
import { ServerError } from "@lindorm-io/errors";

export const getJwt = (ctx: DefaultLindormJwtContext, issuer: string): JWT => {
  if (!ctx.keystore) {
    throw new ServerError("Invalid keystore", {
      description: "Keystore not set",
    });
  }

  if (ctx.keystore.getKeys().length === 0) {
    throw new ServerError("Invalid keystore", {
      description: "Unable to get any valid keys",
    });
  }

  return new JWT({
    issuer,
    keystore: ctx.keystore,
    logger: ctx.logger,
  });
};
