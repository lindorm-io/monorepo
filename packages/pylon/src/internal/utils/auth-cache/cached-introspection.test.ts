import { describe, expect, test } from "vitest";
import type { PylonIntrospection } from "../../../types/index.js";
import { fromCachedIntrospection } from "./from-cached-introspection.js";
import { toCachedIntrospection } from "./to-cached-introspection.js";

const ACTIVE: PylonIntrospection = {
  active: true,
  subject: "alice",
  issuer: "https://test.lindorm.io/",
  clientId: "client-a",
  scope: ["openid", "profile"],
  permissions: ["users:read"],
  expiresAt: new Date("2026-08-06T12:00:00.000Z"),
  issuedAt: new Date("2026-08-06T11:00:00.000Z"),
  confirmation: { thumbprint: "thumb" },
  tokenType: "Bearer",
  username: "alice@lindorm.io",
};

describe("cached introspection payload", () => {
  test("should store the claims in wire form", () => {
    expect(toCachedIntrospection(ACTIVE)).toMatchSnapshot();
  });

  // The column is plain JSON and proteus REJECTS a Date inside one
  // (assertSerialisableJsonFields) — the payload must be JSON-native throughout.
  test("should hold nothing a JSON column cannot store", () => {
    const payload = toCachedIntrospection(ACTIVE);

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  // A HIT must be indistinguishable from a MISS, Dates and all — including the
  // two non-registry members (`tokenType`, `username`) that ride in `custom`.
  test("should round-trip an active answer unchanged", () => {
    expect(fromCachedIntrospection(toCachedIntrospection(ACTIVE))).toEqual(ACTIVE);
  });

  // RFC 7662 §2.2 — an inactive answer is `{ active: false }` and nothing else,
  // but it is still a real entry, so it must round-trip too.
  test("should round-trip an inactive answer", () => {
    const payload = toCachedIntrospection({ active: false });

    expect(payload).toEqual({ active: false, claims: null });
    expect(fromCachedIntrospection(payload)).toEqual({ active: false });
  });
});
