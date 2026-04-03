export const roomJoinHandler = async (ctx: any) => {
  ctx.socket.emit("rooms:join:response", {
    event: ctx.event,
    middlewareChain: ctx.state?.middlewareChain,
    data: ctx.data,
  });
};
export const ON = roomJoinHandler;
