export const roomLeaveHandler = async (ctx: any) => {
  ctx.socket.emit("rooms:leave:response", {
    event: ctx.event,
    middlewareChain: ctx.state?.middlewareChain,
    data: ctx.data,
  });
};
export const ONCE = roomLeaveHandler;
