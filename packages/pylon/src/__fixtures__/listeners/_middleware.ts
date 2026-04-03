export const listenerRootMiddleware = async (_ctx: any, next: any) => {
  await next();
};
export const MIDDLEWARE = [listenerRootMiddleware];
