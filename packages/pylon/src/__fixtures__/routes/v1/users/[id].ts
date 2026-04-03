export const GET = async (ctx: any) => {
  ctx.body = {
    route: "v1/users/:id",
    method: "GET",
    params: ctx.params,
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
};

export const PUT = async (ctx: any) => {
  ctx.body = {
    route: "v1/users/:id",
    method: "PUT",
    params: ctx.params,
    data: ctx.data,
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
};

export const DELETE = async (ctx: any) => {
  ctx.body = {
    route: "v1/users/:id",
    method: "DELETE",
    params: ctx.params,
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
};
