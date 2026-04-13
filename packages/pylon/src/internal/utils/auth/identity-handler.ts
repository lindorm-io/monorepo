import { isParsedJwt } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonHttpMiddleware } from "../../../types";

export const identityHandler: PylonHttpMiddleware = async (ctx) => {
  if (!ctx.state.session) {
    throw new ClientError("Session not found", {
      status: ClientError.Status.Unauthorized,
    });
  }

  if (!ctx.state.session.idToken) {
    throw new ClientError("ID token not found");
  }

  const verified = await ctx.aegis.verify(ctx.state.session.idToken);

  if (!isParsedJwt(verified)) {
    throw new ClientError("Invalid ID token format");
  }

  const { claims, ...rest } = verified.payload;

  ctx.body = {
    ...claims,
    ...rest,
  };
  ctx.status = 200;
};
