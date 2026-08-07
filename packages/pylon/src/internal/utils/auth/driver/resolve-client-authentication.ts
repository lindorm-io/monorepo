import { conduitBasicAuthMiddleware } from "@lindorm/conduit";
import type { ConduitMiddleware } from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { KryptosKit } from "@lindorm/kryptos";
import type { TokenRequest } from "@lindorm/openid";
import type { Dict } from "@lindorm/types";
import type {
  PylonAuthDriverClientAssertionSettings,
  PylonAuthDriverContext,
  PylonClientAuthMethod,
} from "../../../../types/index.js";
import { mintClientAssertion } from "./mint-client-assertion.js";

export type ResolveClientAuthenticationOptions = {
  assertion: PylonAuthDriverClientAssertionSettings;
  /**
   * The `aud` of an assertion — the provider's token endpoint. `null` when the
   * provider publishes none, which only the two ASSERTION methods care about:
   * RFC 7523 §3 makes `aud` mandatory on the assertion, and the other three
   * methods never mint one.
   */
  audience: string | null;
  clientId: string;
  clientSecret?: string;
  method: PylonClientAuthMethod;
};

export type PylonClientAuthentication = {
  /** Parameters to merge into the form body. Snake-cased on the way out. */
  body: Dict;
  /** Middleware carrying the credentials in headers instead. */
  middleware: Array<ConduitMiddleware>;
};

/** RFC 7523 §2.2 — the only `client_assertion_type` this profile defines. */
const CLIENT_ASSERTION_TYPE: TokenRequest["clientAssertionType"] =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

/**
 * Compose the chosen client-authentication method into the parts a request
 * needs — a body fragment, header middleware, or both empty.
 */
export const resolveClientAuthentication = async (
  context: PylonAuthDriverContext,
  options: ResolveClientAuthenticationOptions,
): Promise<PylonClientAuthentication> => {
  const { assertion, audience, clientId, clientSecret, method } = options;

  switch (method) {
    // OIDC Core §9 / RFC 6749 §2.3.1 — credentials in the Authorization header,
    // never in the form. The secret must not reach a query log.
    case "client_secret_basic":
      if (!isString(clientSecret)) {
        throw new ServerError("Client secret is required for client_secret_basic", {
          code: "client_secret_missing",
          title: "Client Secret Missing",
          type: "urn:lindorm:pylon:error:client_secret_missing",
          details:
            "The driver resolved client_secret_basic but carries no clientSecret. A client without a secret authenticates with the `none` method.",
          data: { clientId, method },
        });
      }

      return {
        body: {},
        middleware: [conduitBasicAuthMiddleware(clientId, clientSecret)],
      };

    // OIDC Core §9 — credentials as form parameters.
    case "client_secret_post":
      if (!isString(clientSecret)) {
        throw new ServerError("Client secret is required for client_secret_post", {
          code: "client_secret_missing",
          title: "Client Secret Missing",
          type: "urn:lindorm:pylon:error:client_secret_missing",
          details:
            "The driver resolved client_secret_post but carries no clientSecret. A client without a secret authenticates with the `none` method.",
          data: { clientId, method },
        });
      }

      return { body: { clientId, clientSecret }, middleware: [] };

    // OIDC Core §9 — the secret NEVER reaches the wire; only a MAC over a
    // short-lived, single-use assertion does.
    //
    // ⚠ The MAC key is the client secret VERBATIM: "The HMAC is calculated
    // using the octets of the UTF-8 representation of the client_secret as the
    // shared key" (OIDC Core §9, restated at §10.1). Nothing may be derived
    // from it — the provider holds only the secret and reproduces the MAC from
    // exactly those octets. A secret shorter than the algorithm's MAC key size
    // is rejected by kryptos, which is the same floor OIDC Core §16.19 sets:
    // a client_secret used for symmetric signatures must carry at least the
    // octets the algorithm requires.
    case "client_secret_jwt": {
      if (!isString(clientSecret)) {
        throw new ServerError("Client secret is required for client_secret_jwt", {
          code: "client_secret_missing",
          title: "Client Secret Missing",
          type: "urn:lindorm:pylon:error:client_secret_missing",
          details:
            "The driver resolved client_secret_jwt but carries no clientSecret. The assertion is MAC'd with the secret itself (OIDC Core §9), so there is nothing to sign with. A client without a secret authenticates with the `none` method.",
          data: { clientId, method },
        });
      }

      if (!isString(audience)) {
        throw new ServerError("Assertion audience is required for client_secret_jwt", {
          code: "client_assertion_audience_missing",
          title: "Client Assertion Audience Missing",
          type: "urn:lindorm:pylon:error:client_assertion_audience_missing",
          details:
            "The driver resolved client_secret_jwt but published no token endpoint to use as the assertion `aud`. RFC 7523 §3 makes `aud` mandatory, and OIDC Core §9 names the token endpoint URL as that value, so there is nothing to address the assertion to.",
          data: { clientId, method },
        });
      }

      const clientAssertion = await mintClientAssertion(context, {
        audience,
        clientId,
        expiry: assertion.expiry,
        key: {
          kryptos: KryptosKit.from.utf({
            // A DETERMINISTIC, non-secret `kid`. Kryptos gives an oct key a
            // RANDOM id when none is named, which would put a different `kid`
            // on every assertion — noise the provider cannot resolve and a
            // moving target for anyone verifying one. The client id is the
            // honest answer to "which key is this": the secret registered to
            // this client. A digest of the secret would also be stable, and is
            // deliberately NOT used — it would publish an offline-guessable
            // oracle for the secret in a header sent to the provider.
            id: clientId,
            // OIDC Core §9: "an HMAC SHA algorithm, such as HMAC SHA-256".
            // HS256 is the interoperable floor every provider implements.
            algorithm: "HS256",
            privateKey: clientSecret,
            type: "oct",
            use: "sig",
          }),
        },
      });

      return {
        // RFC 7521 §4.2 makes `client_id` OPTIONAL alongside an assertion — the
        // assertion already names the client — but REQUIRES it to agree when
        // present, and OIDC Core §9's own example sends it. Sending it costs
        // nothing and providers that key their client lookup on it still work.
        body: { clientAssertion, clientAssertionType: CLIENT_ASSERTION_TYPE, clientId },
        middleware: [],
      };
    }

    // OIDC Core §9 — the strongest of the four: the provider holds only the
    // PUBLIC half, so nothing it stores can be replayed as this client.
    case "private_key_jwt": {
      if (!isObject(assertion.key)) {
        throw new ServerError("Client assertion key is required for private_key_jwt", {
          code: "client_assertion_key_missing",
          title: "Client Assertion Key Missing",
          type: "urn:lindorm:pylon:error:client_assertion_key_missing",
          details:
            "The driver resolved private_key_jwt but names no clientAssertion.key. Configure the signing key whose public half the client registered with the provider; pylon will not silently reach for the deployment's default signing key.",
          data: { clientId, method },
        });
      }

      if (!isString(audience)) {
        throw new ServerError("Assertion audience is required for private_key_jwt", {
          code: "client_assertion_audience_missing",
          title: "Client Assertion Audience Missing",
          type: "urn:lindorm:pylon:error:client_assertion_audience_missing",
          details:
            "The driver resolved private_key_jwt but published no token endpoint to use as the assertion `aud`. RFC 7523 §3 makes `aud` mandatory, and OIDC Core §9 names the token endpoint URL as that value, so there is nothing to address the assertion to.",
          data: { clientId, method },
        });
      }

      const clientAssertion = await mintClientAssertion(context, {
        audience,
        clientId,
        expiry: assertion.expiry,
        key: assertion.key,
      });

      return {
        body: { clientAssertion, clientAssertionType: CLIENT_ASSERTION_TYPE, clientId },
        middleware: [],
      };
    }

    // RFC 7591 §2 `none` — a public client. RFC 6749 §3.2.1 still requires it to
    // identify itself, so `client_id` goes in the body and nothing else.
    case "none":
      return { body: { clientId }, middleware: [] };

    default:
      throw new ServerError("Unknown client authentication method", {
        code: "client_auth_method_unknown",
        title: "Client Auth Method Unknown",
        type: "urn:lindorm:pylon:error:client_auth_method_unknown",
        details:
          "The resolved client authentication method is not one pylon composes; see the method in error data.",
        data: { method },
      });
  }
};
