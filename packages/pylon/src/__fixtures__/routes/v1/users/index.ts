export const GET = async (ctx: any) => {
  ctx.body = {
    route: "v1/users",
    method: "GET",
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 200;
};

export const createUserSchema = async (_ctx: any, next: any) => {
  await next();
};

export const createUser = async (ctx: any) => {
  ctx.body = {
    route: "v1/users",
    method: "POST",
    data: ctx.data,
    middlewareChain: ctx.state.middlewareChain,
  };
  ctx.status = 201;
};

export const POST = [createUserSchema, createUser];
