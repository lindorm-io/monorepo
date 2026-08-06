import {
  conduitBearerAuthMiddleware,
  conduitChangeResponseDataMiddleware,
} from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { Claims } from "@lindorm/openid";
import { UserinfoEndpointFailed } from "../../../../errors/UserinfoEndpointFailed.js";
import type {
  PylonAuthDriverContext,
  PylonAuthEndpoints,
  PylonUserinfo,
} from "../../../../types/index.js";
import { parseUserinfo } from "../parse-userinfo.js";

export type FetchUserinfoOptions = {
  accessToken: string;
  endpoints: PylonAuthEndpoints;
};

/**
 * OIDC Core §5.3 — fetch the userinfo response with the access token as a
 * bearer credential and normalise it to {@link PylonUserinfo}.
 */
export const fetchUserinfo = async (
  context: PylonAuthDriverContext,
  options: FetchUserinfoOptions,
): Promise<PylonUserinfo> => {
  const { accessToken, endpoints } = options;

  // `userinfo_endpoint` is only RECOMMENDED (OIDC Discovery §3) — a provider
  // that omits it cannot serve this call at all. Fail by name instead of
  // requesting `undefined`.
  if (!isString(endpoints.userinfoEndpoint)) {
    throw new ServerError("IdP does not support the userinfo endpoint", {
      code: "idp_userinfo_endpoint_not_supported",
      title: "IdP Userinfo Endpoint Not Supported",
      type: "urn:lindorm:pylon:error:idp_userinfo_endpoint_not_supported",
      status: ServerError.Status.NotImplemented,
      details:
        "The driver resolved no `userinfo_endpoint` (RECOMMENDED, not REQUIRED, by OIDC Discovery §3), so userinfo cannot be fetched. Supply the endpoint through the amphora `idp.openIdConfiguration` override if the IdP serves one without advertising it, or use a driver that returns it.",
      data: { issuer: endpoints.issuer },
    });
  }

  let data: Claims;

  try {
    // Unbounded case conversion here on purpose: a userinfo response nests
    // legitimately (OIDC Core §5.1 `address`) and every key is OIDC's own.
    ({ data } = await context.conduit.get<Claims>(endpoints.userinfoEndpoint, {
      middleware: [
        conduitBearerAuthMiddleware(accessToken),
        conduitChangeResponseDataMiddleware(),
      ],
    }));
  } catch (error) {
    throw new UserinfoEndpointFailed(
      error instanceof Error ? error.message : "Userinfo endpoint request failed",
      {
        code: "userinfo_endpoint_failed",
        title: "Userinfo Endpoint Failed",
        details:
          "The request to the IdP userinfo endpoint did not complete successfully; see the userinfoEndpoint in error data",
        data: { userinfoEndpoint: endpoints.userinfoEndpoint },
        debug: { error },
      },
    );
  }

  // Parsed OUTSIDE the try: a missing `sub` is a malformed response, and
  // wrapping it in the transport error would bury the specific code.
  return parseUserinfo(data);
};
