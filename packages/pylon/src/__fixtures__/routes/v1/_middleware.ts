export const v1Middleware = async (ctx: any, next: any) => {
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("v1");
  await next();
};
export const MIDDLEWARE = [v1Middleware];
