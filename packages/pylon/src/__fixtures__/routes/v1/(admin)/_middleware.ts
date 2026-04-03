export const adminMiddleware = async (ctx: any, next: any) => {
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("admin");
  await next();
};
export const MIDDLEWARE = [adminMiddleware];
