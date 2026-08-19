import { describe, expect, test } from "vitest";
import { verifyCitation } from "../../__fixtures__/spec-corpus/verify-citation.js";
import { ACT_MEMBERS } from "../claims/act-members.js";
import { ADDRESS_MEMBERS } from "../claims/address-members.js";
import { AUTHORIZATION_DETAIL_MEMBERS } from "../claims/authorization-details-members.js";
import { CLAIM_SPECS } from "../claims/claims-registry.js";
import { CNF_MEMBERS } from "../claims/cnf-members.js";
import { SUB_ID_MEMBERS } from "../claims/sub-id-members.js";
import { HEADER_SPECS } from "../header/header-registry.js";
import type { SpecCitation } from "./spec-citation.js";
import { specUrl } from "./spec-citation.js";
import type { Wire } from "./wire.js";
import { type WireKey, wireKeyName } from "./wire-key.js";

/**
 * The check that makes {@link ParamSpec.spec} worth having: every `rfc`/`oidc`
 * cell is resolved against the COMMITTED corpus (`src/__fixtures__/rfc/`), and
 * the cited section must name the parameter's own wire spelling.
 *
 * ⚠ FAIL-CLOSED BY CONSTRUCTION, which is the whole point — an absent corpus
 * file, an unknown document, an implausibly short extract and a url that does
 * not match its section all THROW rather than returning nothing. A harness that
 * reports green because it extracted nothing is the failure mode this replaces.
 * `__fixtures__/spec-corpus/verify-citation.test.ts` proves each refusal,
 * including a permanent `RFC 7519 §99.9` citation that must never resolve.
 */

type Entry = {
  domain: string;
  spec: SpecCitation;
  wire: Record<Wire, WireKey>;
};

const REGISTRIES: ReadonlyArray<[string, ReadonlyArray<Entry>]> = [
  ["claims", CLAIM_SPECS],
  ["headers", HEADER_SPECS],
  ["act members", ACT_MEMBERS],
  ["address members", ADDRESS_MEMBERS],
  ["authorization_details members", AUTHORIZATION_DETAIL_MEMBERS],
  ["cnf members", CNF_MEMBERS],
  ["sub_id members", SUB_ID_MEMBERS],
];

/**
 * The token the cited section must name. JOSE is the spelling every citation is
 * chosen on — a parameter whose two wires are defined by different documents
 * cites the JOSE-side one — and the COSE name serves the parameters JOSE does
 * not carry.
 */
const governingName = (entry: Entry): string => {
  const name = wireKeyName(entry.wire.jose) ?? wireKeyName(entry.wire.cose);

  if (name !== undefined) return name;

  throw new Error(`${entry.domain} is absent on both wires`);
};

describe("registry spec citations", () => {
  for (const [registry, entries] of REGISTRIES) {
    describe(registry, () => {
      test("every entry resolves to a section that names its wire spelling", () => {
        const headings: Record<string, string> = {};

        for (const entry of entries) {
          if (entry.spec.kind === "policy") {
            expect(entry.spec.why).not.toBe("");
            headings[entry.domain] = "POLICY";
            continue;
          }

          const extract = verifyCitation(entry.spec, {
            governs: [governingName(entry)],
          });

          expect(entry.spec.url).toBe(specUrl(entry.spec));
          headings[entry.domain] = extract.heading;
        }

        expect(headings).toMatchSnapshot();
      });
    });
  }

  // A silent drift to `policy` would empty the corpus check without failing it,
  // so the split is pinned rather than merely computed.
  test("the split across the three arms is what it was", () => {
    const counts = { oidc: 0, policy: 0, rfc: 0 };

    for (const [, entries] of REGISTRIES) {
      for (const entry of entries) counts[entry.spec.kind] += 1;
    }

    expect(counts).toMatchSnapshot();
  });
});
