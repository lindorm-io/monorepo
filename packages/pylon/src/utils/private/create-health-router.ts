import { PylonRouter } from "../../classes";
import { OptionsHandler, PylonHttpContext } from "../../types";

export const createHealthRouter = <C extends PylonHttpContext>(
  handler?: OptionsHandler<C>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  router.get("/", async (ctx) => {
    if (handler) {
      await handler(ctx);
    }

    ctx.body = undefined;
    ctx.status = 204;
  });

  return router;
};
