import { PylonRouter, useHandler } from "../../../src/index.js";

export const router = new PylonRouter();

// Mints what the `/authorized` mount actually accepts — the `access_token`
// profile (RFC 9068). The `default` profile stamps no `application/at+jwt` typ
// and requires no `client_id`, so a token from it is refused by the profile
// floor: a reader following this example would get a credential the very next
// route rejects.
//
// The `audience` is the same identifier `/authorized` states as its own — a
// token is minted FOR one resource server and checked BY that one.
router.get(
  "/",
  useHandler(async (ctx) => {
    const token = await ctx.aegis.mint("access_token", {
      audience: ["http://test.lindorm.io/api"],
      clientId: "example-client",
      expires: "1h",
      subject: "test",
    });

    return { body: { token } };
  }),
);
