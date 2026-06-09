import { ClientError } from "@lindorm/errors";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../../types/index.js";

export const createUserinfoHandler = <
  C extends PylonHttpContext,
>(): PylonHttpMiddleware<C> =>
  async function userinfoHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("No active session for userinfo request", {
        code: "userinfo_session_required",
        title: "Userinfo Session Required",
        type: "urn:lindorm:pylon:error:userinfo_session_required",
        status: ClientError.Status.Unauthorized,
        details: "The userinfo endpoint requires an authenticated session",
      });
    }

    ctx.body = await ctx.auth.userinfo();
    ctx.status = 200;
  };
