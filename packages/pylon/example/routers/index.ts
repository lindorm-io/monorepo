import { PylonRouter } from "../../src/index.js";

export const router = new PylonRouter();

router.use(async (ctx, next) => {
  ctx.logger.info("Hello from index router");
  await next();
});
