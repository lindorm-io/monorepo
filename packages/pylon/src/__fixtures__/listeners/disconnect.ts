export const disconnectHandler = async (ctx: any) => {
  ctx.io.socket.data.disconnectReason = ctx.data?.reason;
  ctx.io.socket.data.disconnectHandlerFired = true;
};
export const ON = disconnectHandler;
