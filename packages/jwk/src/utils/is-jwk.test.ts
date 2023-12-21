import { isJwk } from "./is-jwk";

describe("isJwk", () => {
  test("should return true for EC JWK", () => {
    const d =
      "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu";
    const x =
      "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz";
    const y =
      "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW";

    expect(
      isJwk({
        crv: "P-521",
        d,
        x,
        y,
        kty: "EC",
      }),
    ).toBe(true);
  });

  test("should return true for RSA JWK", () => {
    const e = "AQAB";
    const d =
      "TN1F4P671vw6LiCYeZpJerGjU8f/qtLMyU+VfMLDPshy1HOjRW/wTS6RH9b/WEukFFFc+1OpabhbQnf0EN8LrAib0RrZKAPtxCsDyzB66r/crT+2TYjFIm1gLNdfcnSrMpdfbgFBJl4NkRBSYHm+Q6MoCny7za0K3FP1sZK1ZQE=";
    const dp =
      "yIhhYhpsCD6QIvgJ7yHEYEsS5EGhbLzgmTsAsed5fotMn/iDkSF+3/oUn9OdzpeI1eXwsSznggK9lqBlQ5kMsQ==";
    const dq =
      "fwJtLJjBJ/o8ZJ4OLz26Qdep8Dfelaltet5ncTxc+YR9NFOWft0pQBu0gYCGLw2aYNcFbmoayqHYSmES97qPbQ==";
    const n =
      "p1XPaUhtCLVhTdnSpGLOlX2AAxb0qbCazho/6vsIpy7jD398xxXi/o/NgfCeO9MRnqBKq3FynBPoSAECDEWiWqN4ic6KzYj61x/FxKHBx8xn8TuSCS0/XnB2wAUNPOayj1W2cE2Bu3xp815rWcrbkVr5mr6DO3GQjmmTDVYWbgU=";
    const p =
      "1dQKVwjhdrXAz/WoT6/X4728q9t4V36zrYLelzrZ9rTl/3i61wcFwyz+pmy8CrfqQ4VOApKIoUBqu/DjZuGSCQ==";
    const q =
      "yFZiSv8BqXQHEPPo/S8G4S+01Ie3R7/kOeqcCpiuR9avpFLArpypE54ciONUPgHLrhx98qbL6O+GIP8dac6LHQ==";
    const qi =
      "DNtq71ngu8GSu7iFTbVJQNQQJ/SMOrkRbEP8ugj34wH30FY5DYmKlKLvxlp1eolH/sE2GhzvJd1avuYtA+YQVw==";

    expect(
      isJwk({
        e,
        d,
        dp,
        dq,
        n,
        p,
        q,
        qi,
        kty: "RSA",
      }),
    ).toBe(true);
  });
});
