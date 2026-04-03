export const healthGet = async (_ctx: any, next: any) => {
  await next();
};
export const GET = healthGet;
