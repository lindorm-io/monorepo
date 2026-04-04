export const echoHandler = async (ctx: any) => {
  ctx.ack?.({ text: ctx.data?.text, event: ctx.event });
};
export const ON = echoHandler;
