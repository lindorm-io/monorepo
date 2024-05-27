import { PylonRouter } from "../../../src";

export const router = new PylonRouter();

router.get("/", async (ctx) => {
  ctx.logger.info("GET /test");
  ctx.status = 200;
  ctx.data = "GET /test";
});
