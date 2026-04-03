export const chatMessageHandler = async (_ctx: any, next: any) => {
  await next();
};
export const ON = chatMessageHandler;
