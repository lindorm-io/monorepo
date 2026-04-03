import { Aegis, ParsedJwt } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { OpenIdClaims } from "@lindorm/types";
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

  const {
    payload: { claims, ...rest },
  } = Aegis.parse<ParsedJwt<OpenIdClaims>>(ctx.state.session.idToken);

  ctx.body = {
    ...claims,
    ...rest,
  };
  ctx.status = 200;
};
