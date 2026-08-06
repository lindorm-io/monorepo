import { describe, expect, test } from "vitest";
import type { PylonIntrospection } from "../../../types/index.js";
import { fromCachedPayload } from "./from-cached-payload.js";
import { toCachedPayload } from "./to-cached-payload.js";

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
    expect(toCachedPayload(ACTIVE)).toMatchSnapshot();
  });

  // The column is plain JSON and proteus REJECTS a Date inside one
  // (assertSerialisableJsonFields) — the payload must be JSON-native throughout.
  test("should hold nothing a JSON column cannot store", () => {
    const payload = toCachedPayload(ACTIVE);

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  // A HIT must be indistinguishable from a MISS, Dates and all — including the
  // two non-registry members (`tokenType`, `username`) that ride in `custom`.
  test("should round-trip an active answer unchanged", () => {
    expect(fromCachedPayload(toCachedPayload(ACTIVE))).toEqual(ACTIVE);
  });

  // RFC 7662 §2.2 — an inactive answer is `{ active: false }` and nothing else,
  // but it is still a real entry, so it must round-trip too.
  test("should round-trip an inactive answer", () => {
    const payload = toCachedPayload({ active: false });

    expect(payload).toEqual({ active: false, claims: null });
    expect(fromCachedPayload(payload)).toEqual({ active: false });
  });
});
