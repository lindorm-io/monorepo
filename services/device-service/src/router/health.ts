import { Context } from "../types";
import { HttpStatus, Router } from "@lindorm-io/koa";

const router = new Router<unknown, Context>();
export default router;

router.get("/", async (ctx: Context): Promise<void> => {
  ctx.body = undefined;
  ctx.status = HttpStatus.Success.NO_CONTENT;
});
