import { ClientError } from "@lindorm/errors";
import { PylonAuthConfig, PylonHttpContext, PylonHttpMiddleware } from "../../../types";
import { getAuthClient } from "./get-auth-client";

export const createUserinfoHandler = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonHttpMiddleware<C> =>
  async function userinfoHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    const client = getAuthClient(ctx, config);

    ctx.body = await client.userinfo(ctx.state.session.accessToken);
    ctx.status = 200;
  };
