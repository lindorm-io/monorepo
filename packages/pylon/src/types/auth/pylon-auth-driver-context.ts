import type { IAegis } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import type { IConduit } from "@lindorm/conduit";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSession } from "@lindorm/proteus";
import type { Environment } from "@lindorm/types";

/**
 * The NARROW, read-only context a driver is handed on every call.
 *
 * ⚠ This is deliberately NOT the pylon request context. A driver has no
 * cookies, no session, no state to write, and no way to redirect — everything a
 * third-party driver could weaken by omission (state, nonce, PKCE, cookie
 * sealing, redirect_uri allowlisting, token verification) stays on pylon's side
 * of the seam, and the seam is enforced by the COMPILER rather than by
 * documentation.
 *
 * A parameter is cheap to add later and impossible to remove without breaking
 * every driver already written, so this starts as small as it can be:
 *
 * - `aegis` — signing and verification over the SAME keys `amphora` already
 *   holds. It grants NO new authority: `new Aegis({ amphora, logger })` is a
 *   wrapper over the vault that is on this context anyway, so a driver could
 *   always reach crypto — aegis only makes it ergonomic. It is here because
 *   RFC 7523 §2.2 client authentication (`client_secret_jwt` /
 *   `private_key_jwt`) has to MINT a signed assertion per token request.
 * - `amphora` — the key vault and the registered upstream IdP, which is where a
 *   discovery-backed driver reads its provider metadata from.
 * - `conduit` — the outbound HTTP client, ALREADY correlation-tagged for this
 *   request and already case-converting outbound bodies and queries. A driver
 *   adds per-call middleware (client authentication, bearer tokens) and pins the
 *   inbound case depth it needs; it never constructs its own client.
 * - `kv` — pylon's AUTHORITATIVE ephemeral source, request-scoped (the same
 *   session `ctx.kv` hands a route, with this request's logger and hook meta
 *   already attached). It is `kv` and never `cache`: a driver that resolves an
 *   opaque token against its own store is doing an authoritative lookup, and a
 *   token record is not disposable. `undefined` when the deployment configured
 *   no `kv`. It stays the ONLY storage on this seam — no cookies, no session
 *   writes, no `ctx.state`.
 * - `environment` / `logger` — the ambient operational context.
 */
export type PylonAuthDriverContext = {
  readonly aegis: IAegis;
  readonly amphora: IAmphora;
  readonly conduit: IConduit;
  readonly environment: Environment;
  readonly kv: IProteusSession | undefined;
  readonly logger: ILogger;
};
