import { ClientError } from "@lindorm/errors";
import { PylonHttpContext, PylonHttpMiddleware } from "../../../types";

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
