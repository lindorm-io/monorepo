import { PylonRouter, useHandler } from "../../../src";

export const router = new PylonRouter();

router.get(
  "/is-authorized",
  useHandler(async (ctx) => {
    return { body: { subject: ctx.state.tokens.bearer.payload.subject } };
  }),
);
