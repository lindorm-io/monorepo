export const socketAuthRootMiddleware = async (ctx: any, next: any) => {
  ctx.state = ctx.state || {};
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("socket-auth-root");
  await next();
};

export const MIDDLEWARE = [socketAuthRootMiddleware];
