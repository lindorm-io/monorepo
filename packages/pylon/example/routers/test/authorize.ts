import { PylonRouter, useHandler } from "../../../src";

export const router = new PylonRouter();

router.get(
  "/",
  useHandler(async (ctx) => {
    const token = await ctx.aegis.jwt.sign({
      expires: "1h",
      subject: "test",
      tokenType: "access_token",
    });

    return { body: { token } };
  }),
);
