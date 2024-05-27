import { PylonRouter } from "../../src";

export const router = new PylonRouter();

router.use(async (ctx, next) => {
  ctx.logger.info("Hello from index router");
  await next();
});
