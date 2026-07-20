export const secureEchoHandler = async (ctx: any) => {
  const verified = ctx.state?.tokens?.accessToken;

  ctx.ack?.({
    event: ctx.event,
    text: ctx.data?.text,
    authenticated: true,
    subject: verified?.claims?.subject,
    middlewareChain: ctx.state?.middlewareChain,
  });
};

export const ON = secureEchoHandler;
