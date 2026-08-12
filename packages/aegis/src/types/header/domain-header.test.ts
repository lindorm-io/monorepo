import { describe, expect, test } from "vitest";
import {
  headerByDomain,
  headerByJose,
  headerJoseName,
} from "../../internal/header/header-registry.js";
import type { KitOwnedDomainParam } from "./domain-header.js";
import type { KitOwnedHeaderParam } from "./wire-envelope.js";

/**
 * The two kit-owned parameter lists — one spelled in WIRE names, one in DOMAIN
 * names — describe the same set of parameters from two sides. Nothing in the type
 * system relates them, so this binds them through the header registry: a
 * parameter that becomes kit-owned on one side and stays caller-settable on the
 * other fails here rather than becoming a hole a caller finds.
 *
 * The `Record<Union, true>` literals are what make the runtime lists TOTAL — a
 * missing member and an extra one are both compile errors — so neither list can
 * drift from its own union either.
 */
const KIT_OWNED_WIRE: Record<KitOwnedHeaderParam, true> = {
  alg: true,
  apu: true,
  apv: true,
  enc: true,
  epk: true,
  iv: true,
  kid: true,
  p2c: true,
  p2s: true,
  tag: true,
  typ: true,
  x5c: true,
  x5t: true,
  "x5t#S256": true,
};

const KIT_OWNED_DOMAIN: Record<KitOwnedDomainParam, true> = {
  algorithm: true,
  certificateChain: true,
  certificateThumbprint: true,
  certificateThumbprintSha1: true,
  encryption: true,
  headerType: true,
  initialisationVector: true,
  keyId: true,
  partyProducer: true,
  partyRecipient: true,
  pbkdfIterations: true,
  pbkdfSalt: true,
  publicEncryptionJwk: true,
  publicEncryptionTag: true,
};

describe("the kit-owned header parameters, spelled both ways", () => {
  test("every wire-named kit-owned param resolves to a domain-named one", () => {
    const domains = Object.keys(KIT_OWNED_WIRE)
      .map((jose) => headerByJose(jose)?.domain)
      .sort();

    expect(domains).toEqual(Object.keys(KIT_OWNED_DOMAIN).sort());
  });

  test("every domain-named kit-owned param resolves to a wire-named one", () => {
    const jose = Object.keys(KIT_OWNED_DOMAIN)
      .map((domain) => {
        const spec = headerByDomain(domain);
        return spec ? headerJoseName(spec) : undefined;
      })
      .sort();

    expect(jose).toEqual(Object.keys(KIT_OWNED_WIRE).sort());
  });
});
