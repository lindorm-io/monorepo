import { randomUUID } from "crypto";
import { mintTestAccessToken } from "../mint-test-access-token.js";

export const POST = async (ctx: any) => {
  const subject = ctx.data?.subject ?? "alice";
  const expiresIn = ctx.data?.expiresIn ?? 3600;

  const minted = await mintTestAccessToken(ctx.aegis, { subject, expiresIn });

  const session = {
    id: randomUUID(),
    accessToken: minted.token,
    expiresAt: minted.expiresAt,
    issuedAt: new Date(),
    scope: [],
    subject,
  };

  await ctx.session.set(session);

  ctx.body = {
    subject,
    expiresIn: minted.expiresIn,
  };
  ctx.status = 200;
};
