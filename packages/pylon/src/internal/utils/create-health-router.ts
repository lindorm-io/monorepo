import { PylonRouter } from "../../classes/index.js";
import type { PylonHttpCallback, PylonHttpContext } from "../../types/index.js";

export const createHealthRouter = <C extends PylonHttpContext>(
  callback?: PylonHttpCallback<C>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  router.get("/", async (ctx) => {
    if (callback) {
      await callback(ctx);
    }

    ctx.body = undefined;
    ctx.status = 204;
  });

  return router;
};
