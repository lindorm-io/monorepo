export const getDashboard = async (_ctx: any, next: any) => {
  await next();
};
export const GET = getDashboard;
