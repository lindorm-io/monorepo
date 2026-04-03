export const v1Middleware = async (_ctx: any, next: any) => {
  await next();
};
export const MIDDLEWARE = [v1Middleware];
