export const rootMiddleware = async (ctx: any, next: any) => {
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("root");
  await next();
};
export const MIDDLEWARE = [rootMiddleware];
