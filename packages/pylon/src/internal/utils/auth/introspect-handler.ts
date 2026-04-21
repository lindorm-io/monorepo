import { ClientError } from "@lindorm/errors";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../../types/index.js";

export const createIntrospectHandler = <
  C extends PylonHttpContext,
>(): PylonHttpMiddleware<C> =>
  async function introspectHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    ctx.body = await ctx.auth.introspect();
    ctx.status = 200;
  };
