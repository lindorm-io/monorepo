import { ClientError } from "@lindorm/errors";
import type { PylonHttpMiddleware } from "../../../types/index.js";

export const backchannelLogoutHandler: PylonHttpMiddleware = async (ctx) => {
  const verified = await ctx.aegis.jwt.verify(ctx.data.logoutToken);

  if (
    !verified.payload.claims.events["http://schemas.openid.net/event/backchannel-logout"]
  ) {
    throw new ClientError("Invalid backchannel logout token", {
      code: "invalid_backchannel_logout_token",
      title: "Invalid Backchannel Logout Token",
      type: "urn:lindorm:pylon:error:invalid_backchannel_logout_token",
      status: ClientError.Status.BadRequest,
      details:
        "The logout token is missing the OIDC backchannel-logout event claim (http://schemas.openid.net/event/backchannel-logout)",
      debug: { verified },
    });
  }

  await ctx.session.logout(verified.payload.subject);

  ctx.body = undefined;
  ctx.status = 204;
};
