export const POST = async (ctx: any) => {
  const session = ctx.state.session;

  if (!session) {
    ctx.status = 401;
    ctx.body = { error: "no_session" };
    return;
  }

  const extendedMillis = 3_600_000;
  const nextExpiresAt = new Date(Date.now() + extendedMillis);

  await ctx.session.set({
    ...session,
    expiresAt: nextExpiresAt,
  });

  ctx.status = 204;
};
