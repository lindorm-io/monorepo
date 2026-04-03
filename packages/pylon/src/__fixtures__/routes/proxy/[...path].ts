export const proxyGet = async (_ctx: any, next: any) => {
  await next();
};
export const GET = proxyGet;
