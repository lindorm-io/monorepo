import { describe, expect, test } from "vitest";
import * as openid from "./index.js";
import type {
  Address,
  AuthorizationDetail,
  AuthorizeRequestQuery,
  AuthorizeResponseQuery,
  Claims,
  Configuration,
  GeoLocation,
  IdentityProvider,
  InstantMessaging,
  IntrospectResponse,
  JwksResponse,
  LogoutRequest,
  SocialNetwork,
  TokenRequest,
  TokenResponse,
} from "./index.js";

/**
 * Every public TYPE reached through the root barrel. Types are erased at
 * runtime, so this declaration is the assertion — if a type stops being
 * exported (or is renamed back to an `OpenId*` name), this file stops
 * compiling.
 */
type PublicTypes = {
  address: Address;
  authorizationDetail: AuthorizationDetail;
  authorizeRequestQuery: AuthorizeRequestQuery;
  authorizeResponseQuery: AuthorizeResponseQuery;
  claims: Claims;
  configuration: Configuration;
  geoLocation: GeoLocation;
  identityProvider: IdentityProvider;
  instantMessaging: InstantMessaging;
  introspectResponse: IntrospectResponse;
  jwksResponse: JwksResponse;
  logoutRequest: LogoutRequest;
  socialNetwork: SocialNetwork;
  tokenRequest: TokenRequest;
  tokenResponse: TokenResponse;
};

describe("index", () => {
  test("should export every runtime value", () => {
    expect(Object.keys(openid).sort()).toMatchSnapshot();
  });

  test("should export every public type", () => {
    const keys: Array<keyof PublicTypes> = [
      "address",
      "authorizationDetail",
      "authorizeRequestQuery",
      "authorizeResponseQuery",
      "claims",
      "configuration",
      "geoLocation",
      "identityProvider",
      "instantMessaging",
      "introspectResponse",
      "jwksResponse",
      "logoutRequest",
      "socialNetwork",
      "tokenRequest",
      "tokenResponse",
    ];

    expect(keys).toMatchSnapshot();
  });
});
