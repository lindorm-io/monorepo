import { Context } from "../../types";
import { HttpStatus, Router } from "@lindorm-io/koa";

const router = new Router<unknown, Context>();
export default router;

router.get("/jwks.json", async (ctx: Context): Promise<void> => {
  ctx.body = {
    keys: ctx.keystore.getJWKS(),
  };
  ctx.status = HttpStatus.Success.OK;
});
