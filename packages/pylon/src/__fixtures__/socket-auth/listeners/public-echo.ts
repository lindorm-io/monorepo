export const publicEchoHandler = async (ctx: any) => {
  ctx.ack?.({
    event: ctx.event,
    text: ctx.data?.text,
    authenticated: false,
  });
};

export const ON = publicEchoHandler;
