export const socketAuthRouteRootMiddleware = async (_ctx: any, next: any) => {
  await next();
};

export const MIDDLEWARE = [socketAuthRouteRootMiddleware];
