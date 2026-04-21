import { PylonRouter, useHandler } from "../../../src/index.js";

export const router = new PylonRouter();

router.get(
  "/is-authorized",
  useHandler(async (ctx) => {
    return { body: { subject: ctx.state.tokens.accessToken.payload.subject } };
  }),
);
