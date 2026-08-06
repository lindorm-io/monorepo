import { ClientError } from "@lindorm/errors";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../../__fixtures__/access/dpop.js";
import type { PylonResolvedAccess } from "../../../types/index.js";
import { assertDpopHttpBinding } from "./assert-dpop-http-binding.js";
import { beforeAll, describe, expect, test } from "vitest";

describe("assertDpopHttpBinding", () => {
  const ctx: any = {
    method: "POST",
    origin: "https://api.example.com",
    path: "/orders",
  };
  const uri = "https://api.example.com/orders";
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
      const proof = await client.sign({ method: "POST", uri, accessToken: token });

      expect(() =>
        assertDpopHttpBinding(ctx, access(provenance, client.jkt), {
          proof,
          scheme: true,
        }),
      ).not.toThrow();
    },
  );

  test.each(["verified", "introspected"] as const)(
    "rejects a request-mismatched proof on the %s path",
    async (provenance) => {
      const proof = await client.sign({ method: "GET", uri, accessToken: token });

      expect(() =>
        assertDpopHttpBinding(ctx, access(provenance, client.jkt), {
          proof,
          scheme: true,
        }),
      ).toThrow(ClientError);
    },
  );

  test("rejects a bound credential presented with no proof", async () => {
    expect(() =>
      assertDpopHttpBinding(ctx, access("introspected", client.jkt), {
        proof: undefined,
        scheme: false,
      }),
    ).toThrow(expect.objectContaining({ code: "missing_dpop_proof" }));
  });

  test("rejects a bound credential presented with an empty proof", () => {
    expect(() =>
      assertDpopHttpBinding(ctx, access("verified", client.jkt), {
        proof: "",
        scheme: true,
      }),
    ).toThrow(expect.objectContaining({ code: "missing_dpop_proof" }));
  });

  test("rejects an unbound credential presented under the DPoP scheme", async () => {
    const proof = await client.sign({ method: "POST", uri, accessToken: token });

    expect(() =>
      assertDpopHttpBinding(ctx, access("introspected"), { proof, scheme: true }),
    ).toThrow(expect.objectContaining({ code: "token_not_dpop_bound" }));
  });

  test("passes through an unbound credential presented as bearer", () => {
    expect(() =>
      assertDpopHttpBinding(ctx, access("verified"), {
        proof: undefined,
        scheme: false,
      }),
    ).not.toThrow();
  });

  test("rejects a proof signed by a different key", async () => {
    const other = await createDpopTestClient();
    const proof = await other.sign({ method: "POST", uri, accessToken: token });

    expect(() =>
      assertDpopHttpBinding(ctx, access("introspected", client.jkt), {
        proof,
        scheme: true,
      }),
    ).toThrow();
  });
});
