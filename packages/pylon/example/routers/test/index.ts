import { PylonRouter } from "../../../src";

export const router = new PylonRouter();

router.get("/", async (ctx) => {
  ctx.logger.info("GET /test", {
    headers: ctx.headers,
    params: ctx.params,
    query: ctx.query,
    url: {
      protocol: ctx.protocol,
      host: ctx.host,
      path: ctx.path,
      originalUrl: ctx.originalUrl,
      url: ctx.url,
    },
  });
  ctx.status = 200;
  ctx.data = "GET /test";
});
