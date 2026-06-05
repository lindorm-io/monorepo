import { ClientError } from "@lindorm/errors";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../../types/index.js";

export const createIntrospectHandler = <
  C extends PylonHttpContext,
>(): PylonHttpMiddleware<C> =>
  async function introspectHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("No active session for introspection request", {
        code: "introspect_session_required",
        type: "urn:lindorm:pylon:error:introspect_session_required",
        status: ClientError.Status.Unauthorized,
        details: "The introspection endpoint requires an authenticated session",
      });
    }

    ctx.body = await ctx.auth.introspect();
    ctx.status = 200;
  };
