import { DefaultLindormMiddleware } from "@lindorm-io/koa";

export const middleware: Array<DefaultLindormMiddleware> = [
  async (ctx, next) => {
    await next();
    ctx.set("Access-Control-Allow-Credentials", "true");
    ctx.set("Access-Control-Allow-Headers", "*");
    ctx.set("Access-Control-Allow-Methods", "*");
    ctx.set("Access-Control-Allow-Origin", "http://localhost:4100");
    ctx.set("Cache-Control", "no-cache");
  },
];
