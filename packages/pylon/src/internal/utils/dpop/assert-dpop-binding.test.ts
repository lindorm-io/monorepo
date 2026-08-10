import { ClientError } from "@lindorm/errors";
import { beforeAll, describe, expect, test } from "vitest";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../../__fixtures__/access/dpop.js";
import type { PylonResolvedAccess } from "../../../types/index.js";
import { assertDpopBinding } from "./assert-dpop-binding.js";

/**
 * The binding check is TRANSPORT-NEUTRAL now: it takes `htm`/`htu` as values
 * rather than reading a koa context, which is what lets the socket handshake run
 * the same one. Both shapes are exercised here — an HTTP request and a
 * reconstructed handshake upgrade.
 */
describe("assertDpopBinding", () => {
  const HTTP = {
    htm: "POST",
    htu: { origin: "https://api.example.com", path: "/orders" },
  };
  const HTTP_URI = "https://api.example.com/orders";

  const HANDSHAKE = {
    htm: "GET",
    htu: { origin: "https://api.example.com", path: "/socket.io/" },
  };
  const HANDSHAKE_URI = "https://api.example.com/socket.io/";

  const token = "the-presented-token";

  let client: DpopTestClient;

  const access = (
    provenance: PylonResolvedAccess["provenance"],
    thumbprint?: string,
  ): PylonResolvedAccess =>
    ({
      provenance,
      token,
      claims: thumbprint ? { confirmation: { thumbprint } } : {},
    }) as PylonResolvedAccess;

  beforeAll(async () => {
    client = await createDpopTestClient();
  });

  test.each(["verified", "introspected"] as const)(
    "accepts a matching proof on the %s path",
    async (provenance) => {
      const proof = await client.sign({
        method: "POST",
        uri: HTTP_URI,
        accessToken: token,
      });

      expect(() =>
        assertDpopBinding(access(provenance, client.jkt), {
          ...HTTP,
          proof,
          scheme: true,
        }),
      ).not.toThrow();
    },
  );

  test.each(["verified", "introspected"] as const)(
    "rejects a request-mismatched proof on the %s path",
    async (provenance) => {
      const proof = await client.sign({
        method: "GET",
        uri: HTTP_URI,
        accessToken: token,
      });

      expect(() =>
        assertDpopBinding(access(provenance, client.jkt), {
          ...HTTP,
          proof,
          scheme: true,
        }),
      ).toThrow(ClientError);
    },
  );

  test("rejects a bound credential presented with no proof", () => {
    expect(() =>
      assertDpopBinding(access("introspected", client.jkt), {
        ...HTTP,
        proof: undefined,
        scheme: false,
      }),
    ).toThrow(expect.objectContaining({ code: "missing_dpop_proof" }));
  });

  test("rejects a bound credential presented with an empty proof", () => {
    expect(() =>
      assertDpopBinding(access("verified", client.jkt), {
        ...HTTP,
        proof: "",
        scheme: true,
      }),
    ).toThrow(expect.objectContaining({ code: "missing_dpop_proof" }));
  });

  test("rejects an unbound credential presented under the DPoP scheme", async () => {
    const proof = await client.sign({
      method: "POST",
      uri: HTTP_URI,
      accessToken: token,
    });

    expect(() =>
      assertDpopBinding(access("introspected"), { ...HTTP, proof, scheme: true }),
    ).toThrow(expect.objectContaining({ code: "token_not_dpop_bound" }));
  });

  test("passes through an unbound credential presented as bearer", () => {
    expect(() =>
      assertDpopBinding(access("verified"), {
        ...HTTP,
        proof: undefined,
        scheme: false,
      }),
    ).not.toThrow();
  });

  // The proof itself is now checked HERE rather than by aegis on one arm only,
  // so a proof that fails its own verification must surface as a named pylon
  // error rather than as whatever the crypto layer happened to throw.
  test("rejects a proof signed by a different key, by name", async () => {
    const other = await createDpopTestClient();
    const proof = await other.sign({
      method: "POST",
      uri: HTTP_URI,
      accessToken: token,
    });

    expect(() =>
      assertDpopBinding(access("introspected", client.jkt), {
        ...HTTP,
        proof,
        scheme: true,
      }),
    ).toThrow(expect.objectContaining({ code: "invalid_dpop_proof", status: 401 }));
  });

  test("rejects a proof signed over a different access token", async () => {
    const proof = await client.sign({
      method: "POST",
      uri: HTTP_URI,
      accessToken: "some-other-token",
    });

    expect(() =>
      assertDpopBinding(access("verified", client.jkt), {
        ...HTTP,
        proof,
        scheme: true,
      }),
    ).toThrow(expect.objectContaining({ code: "invalid_dpop_proof" }));
  });

  // The handshake half: the SAME function, given the reconstructed upgrade URI
  // and the fixed `GET` a websocket upgrade always is.
  describe("handshake shape", () => {
    test("accepts a proof over the reconstructed handshake htu", async () => {
      const proof = await client.sign({
        method: "GET",
        uri: HANDSHAKE_URI,
        accessToken: token,
      });

      expect(() =>
        assertDpopBinding(access("introspected", client.jkt), {
          ...HANDSHAKE,
          proof,
          scheme: false,
        }),
      ).not.toThrow();
    });

    test("rejects a proof made for a different origin", async () => {
      const proof = await client.sign({
        method: "GET",
        uri: "https://evil.example.com/socket.io/",
        accessToken: token,
      });

      expect(() =>
        assertDpopBinding(access("verified", client.jkt), {
          ...HANDSHAKE,
          proof,
          scheme: false,
        }),
      ).toThrow(expect.objectContaining({ code: "dpop_htu_mismatch" }));
    });
  });
});
