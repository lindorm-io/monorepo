import { ServerError } from "@lindorm-io/errors";
import { JWT } from "@lindorm-io/jwt";
import { DefaultLindormJwtContext } from "../types";

export const getJwt = (ctx: DefaultLindormJwtContext, issuer: string): JWT => {
  if (!ctx.keystore) {
    throw new ServerError("Invalid Keystore", {
      description: "Keystore not set",
    });
  }

  return new JWT({ issuer }, ctx.keystore, ctx.logger);
};
