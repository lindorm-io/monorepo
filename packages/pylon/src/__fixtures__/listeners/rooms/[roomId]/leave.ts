export const roomLeaveHandler = async (ctx: any) => {
  ctx.socket.emit("rooms:leave:response", {
    event: ctx.event,
    params: ctx.params,
    middlewareChain: ctx.state?.middlewareChain,
    data: ctx.data,
  });
};
export const ONCE = roomLeaveHandler;
