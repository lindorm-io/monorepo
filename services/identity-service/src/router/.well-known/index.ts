import { ServerKoaContext } from "../../types";
import { HttpStatus, Router } from "@lindorm-io/koa";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get("/jwks.json", async (ctx: ServerKoaContext): Promise<void> => {
  ctx.body = { keys: ctx.keystore.getJWKS() };
  ctx.status = HttpStatus.Success.OK;
});
