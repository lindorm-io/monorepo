export const roomLeaveHandler = async (_ctx: any, next: any) => {
  await next();
};
export const ONCE = roomLeaveHandler;
