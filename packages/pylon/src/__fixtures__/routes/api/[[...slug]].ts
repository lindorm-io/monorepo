export const GET = async (ctx: any) => {
  ctx.body = {
    route: "api/optional-catch-all",
    method: "GET",
    params: ctx.params,
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
};
