import { conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { IntrospectResponse } from "@lindorm/openid";
import { sortKeys } from "@lindorm/utils";
import { IntrospectionEndpointFailed } from "../../../../errors/IntrospectionEndpointFailed.js";
import type {
  PylonAuthDriverContext,
  PylonAuthEndpoints,
  PylonClientAuthMethod,
  PylonIntrospection,
} from "../../../../types/index.js";
import { parseIntrospection } from "../parse-introspection.js";
import { resolveClientAuthentication } from "./resolve-client-authentication.js";

export type FetchIntrospectionOptions = {
  clientId: string;
  clientSecret?: string;
  endpoints: PylonAuthEndpoints;
  method: PylonClientAuthMethod;
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
};

/**
 * RFC 7662 — introspect a token at the provider.
 *
 * ⚠ The request is `application/x-www-form-urlencoded` (RFC 7662 §2.1), the
 * same requirement the token endpoint carries. The body is snake-cased by the
 * conduit's own request middleware; conduit encodes AFTER middleware.
 */
export const fetchIntrospection = async (
  context: PylonAuthDriverContext,
  options: FetchIntrospectionOptions,
): Promise<PylonIntrospection> => {
  const { clientId, clientSecret, endpoints, method, token, tokenTypeHint } = options;

  // `introspection_endpoint` is OPTIONAL (RFC 8414 §2) and real providers omit
  // it — Auth0 publishes none. Fail by name instead of posting to `undefined`.
  if (!isString(endpoints.introspectionEndpoint)) {
    throw new ServerError("IdP does not support the introspection endpoint", {
      code: "idp_introspection_endpoint_not_supported",
      title: "IdP Introspection Endpoint Not Supported",
      type: "urn:lindorm:pylon:error:idp_introspection_endpoint_not_supported",
      status: ServerError.Status.NotImplemented,
      details:
        "The driver resolved no `introspection_endpoint` (OPTIONAL per RFC 8414), so the token cannot be introspected remotely. Use locally verifiable JWT access tokens, or supply the endpoint through the amphora `idp.openIdConfiguration` override.",
      data: { issuer: endpoints.issuer },
    });
  }

  const auth = resolveClientAuthentication({ clientId, clientSecret, method });

  let data: IntrospectResponse;

  try {
    ({ data } = await context.conduit.post<IntrospectResponse>(
      endpoints.introspectionEndpoint,
      {
        body: sortKeys({
          ...auth.body,
          token,
          ...(isString(tokenTypeHint) && { tokenTypeHint }),
        }),
        contentType: "application/x-www-form-urlencoded",
        middleware: [
          ...auth.middleware,
          // Depth 1 — RFC 9396 §2 `authorization_details` entries carry fields
          // defined by the schema named in `type`, which MAY be camelCase
          // already; camelising them rewrites someone else's schema.
          conduitChangeResponseDataMiddleware("camel", { depth: 1 }),
        ],
      },
    ));
  } catch (error) {
    throw new IntrospectionEndpointFailed(
      error instanceof Error ? error.message : "Introspection endpoint request failed",
      {
        code: "introspect_endpoint_failed",
        title: "Introspect Endpoint Failed",
        details:
          "The request to the IdP introspection endpoint did not complete successfully; see the introspectionEndpoint in error data",
        data: { introspectionEndpoint: endpoints.introspectionEndpoint },
        debug: { error },
      },
    );
  }

  return parseIntrospection(data);
};
