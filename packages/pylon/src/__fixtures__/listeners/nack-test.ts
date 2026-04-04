export const nackHandler = async (ctx: any) => {
  ctx.nack?.({ code: "test_error", message: "intentional nack" });
};
export const ON = nackHandler;
