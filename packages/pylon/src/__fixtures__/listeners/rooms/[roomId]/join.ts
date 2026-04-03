export const roomJoinHandler = async (_ctx: any, next: any) => {
  await next();
};
export const ON = roomJoinHandler;
