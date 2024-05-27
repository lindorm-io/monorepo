import { PylonRouter } from "../../classes";
import { PylonHttpContext } from "../../types";

export const createHealthRouter = <C extends PylonHttpContext>(): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  router.get("/", async (ctx) => {
    ctx.body = undefined;
    ctx.status = 204;
  });

  return router;
};
