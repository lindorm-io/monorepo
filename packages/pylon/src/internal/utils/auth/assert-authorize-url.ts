import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { ResponseType } from "@lindorm/openid";

export type AssertAuthorizeUrlOptions = {
  /** `null` when the flow runs without PKCE. */
  codeChallenge: string | null;
  state: string;
};

/**
 * What pylon reads back off the URL to drive its own side of the flow: the
 * callback branches on `responseType`, and the exchange replays `scope`.
 */
export type AuthorizeUrlFacts = {
  responseType: ResponseType;
  scope: string;
};

const invalid = (reason: string, data: Record<string, unknown>): never => {
  throw new ServerError("Auth driver produced an invalid authorization URL", {
    code: "authorize_url_invalid",
    title: "Authorize URL Invalid",
    type: "urn:lindorm:pylon:error:authorize_url_invalid",
    details: reason,
    data,
  });
};

/**
 * Hold the driver to what pylon computed.
 *
 * `state` (RFC 6749 §10.12) and the PKCE challenge (RFC 7636 §4.3) are pylon's
 * defences, not the driver's — a driver that dropped either would leave the
 * callback verifying a value that was never on the wire, which is a login that
 * looks protected and is not. They are checked here, once, rather than trusted.
 *
 * The same read yields the two facts pylon needs downstream. `response_type` is
 * REQUIRED by RFC 6749 §4.1.1; a driver whose provider carries it some other way
 * gets pylon's default, `code`, which is the only flow the shipped drivers run.
 */
export const assertAuthorizeUrl = (
  url: URL,
  options: AssertAuthorizeUrlOptions,
): AuthorizeUrlFacts => {
  const state = url.searchParams.get("state");

  if (state !== options.state) {
    invalid(
      "The driver's authorization URL carries no `state`, or a different one than pylon generated. Pylon verifies the value returned to the callback against its own, so the URL must carry it verbatim.",
      { expected: options.state, received: state },
    );
  }

  if (isString(options.codeChallenge)) {
    const challenge = url.searchParams.get("code_challenge");

    if (challenge !== options.codeChallenge) {
      invalid(
        "The driver's authorization URL carries no `code_challenge`, or a different one than pylon derived. The verifier pylon stored would not match, so the exchange could not complete.",
        { received: challenge },
      );
    }
  }

  return {
    responseType:
      (url.searchParams.get("response_type") as ResponseType | null) ?? "code",
    scope: url.searchParams.get("scope") ?? "",
  };
};
