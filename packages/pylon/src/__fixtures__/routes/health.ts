export const GET = async (ctx: any) => {
  ctx.body = {
    route: "health",
    method: "GET",
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
};
