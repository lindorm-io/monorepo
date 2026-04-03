export const chatMiddleware = async (_ctx: any, next: any) => {
  await next();
};
export const MIDDLEWARE = [chatMiddleware];
