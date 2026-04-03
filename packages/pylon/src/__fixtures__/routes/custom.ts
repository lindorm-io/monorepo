import { PylonRouter } from "../../classes";

export const router = new PylonRouter();
router.get("/", async (ctx: any) => {
  ctx.body = {
    route: "custom",
    method: "GET",
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
});
