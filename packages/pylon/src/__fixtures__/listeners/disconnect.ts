export const disconnectHandler = async (ctx: any) => {
  ctx.socket.data.disconnectReason = ctx.data?.reason;
  ctx.socket.data.disconnectHandlerFired = true;
};
export const ON = disconnectHandler;
