export const roomJoinHandler = async (ctx: any) => {
  ctx.io.socket.emit("rooms:join:response", {
    event: ctx.event,
    params: ctx.params,
    middlewareChain: ctx.state?.middlewareChain,
    data: ctx.data,
  });
};
export const ON = roomJoinHandler;
