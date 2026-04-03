export const listenerRootMiddleware = async (ctx: any, next: any) => {
  ctx.state = ctx.state || {};
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("root");
  await next();
};
export const MIDDLEWARE = [listenerRootMiddleware];
