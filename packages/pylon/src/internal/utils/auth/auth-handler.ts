import { ClientError } from "@lindorm/errors";
import { PylonAuthConfig, PylonHttpMiddleware } from "../../../types";

export const createAuthHandler = (config: PylonAuthConfig): PylonHttpMiddleware =>
  async function authHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    ctx.body = {
      ...(config.expose.accessToken && { accessToken: ctx.state.session.accessToken }),
      ...(config.expose.idToken && { idToken: ctx.state.session.idToken }),
      ...(config.expose.scope && { scope: ctx.state.session.scope }),
      ...(config.expose.subject && { subject: ctx.state.session.subject }),
    };
    ctx.status = 200;
  };
