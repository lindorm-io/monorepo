import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";

/**
 * A refresh may not change the connection's proof-of-possession binding — in
 * EITHER direction.
 *
 * A DIFFERENT `cnf.jkt` is a key rotation, and the new key has proved nothing
 * over this socket. A NEWLY INTRODUCED one is the more dangerous half: a
 * connection that handshook unbound (or whose mount disabled DPoP) has no
 * captured thumbprint to compare against, and a refresh event carries no proof —
 * so accepting a bound credential there would serve it as a plain bearer, which
 * is exactly what RFC 9449 §7.1 forbids.
 *
 * ⚠ That second case used to be caught one layer down: the refresh verify passed
 * `trustBoundThumbprint` only when a thumbprint had been captured, so aegis's
 * RFC 9449-strict default refused a bound token for want of a proof. The verify
 * now trusts the binding unconditionally — pylon owns the comparison on both
 * credential arms, and an introspected credential has no aegis verify to lean
 * on at all — so the rule has to be stated here, where it can be read.
 */
export const assertJktUnchanged = (
  expected: string | undefined,
  actual: string | undefined,
): void => {
  const bound = isString(actual) && actual.length > 0;

  if (!expected && !bound) return;
  if (expected && actual === expected) return;

  throw new ClientError("DPoP key rotation requires reconnect", {
    code: "dpop_jkt_changed",
    title: "DPoP JKT Changed",
    type: "urn:lindorm:pylon:error:dpop_jkt_changed",
    details: expected
      ? "The refreshed token cnf.jkt does not match the handshake binding"
      : "The refreshed token is DPoP bound, but this connection established no binding to prove it against",
    status: ClientError.Status.Unauthorized,
    debug: { expected, actual },
  });
};
