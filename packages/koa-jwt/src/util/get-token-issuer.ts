import { DefaultLindormJwtContext } from "../types";
import { JWT } from "@lindorm-io/jwt";
import { ServerError } from "@lindorm-io/errors";

export const getJwt = (ctx: DefaultLindormJwtContext, issuer: string): JWT => {
  if (!ctx.keystore) {
    throw new ServerError("Invalid Keystore", {
      description: "Keystore not set",
    });
  }

  ctx.keystore.getKeys();

  return new JWT({
    issuer,
    keystore: ctx.keystore,
    logger: ctx.logger,
  });
};
