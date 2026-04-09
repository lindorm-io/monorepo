export const chatMessageHandler = async (ctx: any) => {
  ctx.io.socket.emit("chat:message:response", {
    event: ctx.event,
    middlewareChain: ctx.state?.middlewareChain,
    data: ctx.data,
  });
};
export const ON = chatMessageHandler;
