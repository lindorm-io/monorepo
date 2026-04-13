import { ClientError } from "@lindorm/errors";
import { PylonAuthRouterConfig, PylonHttpMiddleware } from "../../../types";

export const createAuthHandler = (
  routerConfig: PylonAuthRouterConfig,
): PylonHttpMiddleware =>
  async function authHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    ctx.body = {
      ...(routerConfig.expose.accessToken && {
        accessToken: ctx.state.session.accessToken,
      }),
      ...(routerConfig.expose.idToken && { idToken: ctx.state.session.idToken }),
      ...(routerConfig.expose.scope && { scope: ctx.state.session.scope }),
      ...(routerConfig.expose.subject && { subject: ctx.state.session.subject }),
    };
    ctx.status = 200;
  };
