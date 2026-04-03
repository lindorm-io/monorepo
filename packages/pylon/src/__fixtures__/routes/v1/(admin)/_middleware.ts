export const adminMiddleware = async (_ctx: any, next: any) => {
  await next();
};
export const MIDDLEWARE = [adminMiddleware];
