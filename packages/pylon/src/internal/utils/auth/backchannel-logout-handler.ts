import { ClientError } from "@lindorm/errors";
import { PylonHttpMiddleware } from "../../../types";

export const backchannelLogoutHandler: PylonHttpMiddleware = async (ctx) => {
  const verified = await ctx.aegis.jwt.verify(ctx.data.logoutToken);

  if (
    !verified.payload.claims.events["http://schemas.openid.net/event/backchannel-logout"]
  ) {
    throw new ClientError("Invalid backchannel logout token", {
      code: "INVALID_BACKCHANNEL_LOGOUT_TOKEN",
      debug: { verified },
    });
  }

  await ctx.session.logout(verified.payload.subject);

  ctx.body = undefined;
  ctx.status = 204;
};
