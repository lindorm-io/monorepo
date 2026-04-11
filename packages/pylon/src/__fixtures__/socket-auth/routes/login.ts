import { mintTestAccessToken } from "../mint-test-access-token";

export const POST = async (ctx: any) => {
  const subject = ctx.data?.subject ?? "alice";
  const expiresIn = ctx.data?.expiresIn ?? 3600;

  const minted = await mintTestAccessToken(ctx.aegis, { subject, expiresIn });

  ctx.body = {
    bearer: minted.token,
    expiresIn: minted.expiresIn,
    subject,
  };
  ctx.status = 200;
};
