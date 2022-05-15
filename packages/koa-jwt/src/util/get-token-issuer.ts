import { DefaultLindormJwtContext } from "../types";
import { TokenIssuer } from "@lindorm-io/jwt";
import { ServerError } from "@lindorm-io/errors";

export const getTokenIssuer = (ctx: DefaultLindormJwtContext, issuer: string): TokenIssuer => {
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

  return new TokenIssuer({
    issuer,
    keystore: ctx.keystore,
    logger: ctx.logger,
  });
};
