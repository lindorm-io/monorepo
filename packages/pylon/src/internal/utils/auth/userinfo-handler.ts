import { ClientError } from "@lindorm/errors";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../../types/index.js";

export const createUserinfoHandler = <
  C extends PylonHttpContext,
>(): PylonHttpMiddleware<C> =>
  async function userinfoHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    ctx.body = await ctx.auth.userinfo();
    ctx.status = 200;
  };
