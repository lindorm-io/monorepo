import { AegisError, type IAegis } from "@lindorm/aegis";
import { type ReadableTime, ms } from "@lindorm/date";
import { lindormId } from "@lindorm/random";
import type { AuthorizeResponseQuery, TokenResponse } from "@lindorm/openid";
import { CannotEstablishSessionIdentity } from "../../../errors/index.js";
import type { IPylonSession } from "../../../interfaces/index.js";

type Data = TokenResponse | AuthorizeResponseQuery;

type ParseTokenDataOptions = {
  resolveSubject?: (accessToken: string) => Promise<string | null>;
  defaultTokenExpiry?: ReadableTime;
  session?: Partial<IPylonSession>;
};

export const parseTokenData = async (
  aegis: IAegis,
  data: Data,
  options?: ParseTokenDataOptions,
): Promise<IPylonSession> => {
  const tdata = data as TokenResponse;
  const now = new Date();

  const session: IPylonSession = {
    id: lindormId({ namespace: "def" }),
    accessToken: "",
    expiresAt: null,
    issuedAt: now,
    scope: [],
    subject: "",
    ...options?.session,
  };

  // Step 1 — Try access token
  if (data.accessToken) {
    session.accessToken = data.accessToken;

    try {
      const verified = await aegis.verify(data.accessToken);

      if (verified.format === "jwt") {
        session.id = verified.claims.sessionId || session.id;
        session.issuedAt = verified.claims.issuedAt ?? session.issuedAt;
        session.expiresAt = verified.claims.expiresAt ?? session.expiresAt;
        session.subject = verified.claims.subject || session.subject;
        if (!session.scope.length && verified.claims.scope?.length) {
          session.scope = verified.claims.scope;
        }
      }
    } catch (err) {
      if (!(err instanceof AegisError)) throw err;
    }
  }

  // Step 2 — Resolve expiry from envelope if needed
  if (!session.expiresAt) {
    const expiresIn = data.expiresIn
      ? data.expiresIn * 1000
      : options?.defaultTokenExpiry
        ? ms(options.defaultTokenExpiry)
        : 0;

    if (data.expiresOn) {
      session.expiresAt = new Date(data.expiresOn * 1000);
    } else if (expiresIn > 0) {
      session.expiresAt = new Date(Date.now() + expiresIn);
    }
  }

  // Scope from envelope (fallback if step 1 didn't populate it)
  if (!session.scope.length && tdata.scope) {
    session.scope = tdata.scope.split(" ").filter(Boolean);
  }

  // Step 3 — Resolve identity from id_token
  if (!session.subject && data.idToken) {
    session.idToken = data.idToken;

    try {
      const verified = await aegis.verify(data.idToken);

      if (verified.format === "jwt") {
        session.id = verified.claims.sessionId || session.id;
        session.issuedAt = verified.claims.issuedAt ?? session.issuedAt;
        session.subject = verified.claims.subject || session.subject;
        if (!session.scope.length && verified.claims.scope?.length) {
          session.scope = verified.claims.scope;
        }
      }
    } catch (err) {
      if (!(err instanceof AegisError)) throw err;
    }
  } else if (data.idToken) {
    session.idToken = data.idToken;
  }

  // Refresh token from token response
  if (tdata.refreshToken) {
    session.refreshToken = tdata.refreshToken;
  }

  // Step 4 — Resolve identity from external resolver (e.g. userinfo endpoint)
  if (!session.subject && options?.resolveSubject && session.accessToken) {
    session.subject = (await options.resolveSubject(session.accessToken)) || "";
  }

  // Step 5 — Throw if no subject
  if (!session.subject) {
    throw new CannotEstablishSessionIdentity({
      code: "cannot_establish_session_identity",
      title: "Cannot Establish Session Identity",
      details:
        "No subject could be derived from the access token, id_token, or external resolver",
      debug: {
        hadAccessToken: Boolean(data.accessToken),
        hadIdToken: Boolean(data.idToken),
        usedResolver: Boolean(options?.resolveSubject),
      },
    });
  }

  return session;
};
