import { describe, expect, test } from "vitest";
import { KryptosKit } from "../../classes/index.js";
import {
  KRYPTOS_AKP_SIG_ML_DSA_44,
  KRYPTOS_EC_SIG_ES256,
  KRYPTOS_OCT_SIG_HS256,
  KRYPTOS_OKP_SIG_ED25519,
  KRYPTOS_RSA_SIG_RS256,
} from "../../fixtures/index.js";
import type { IKryptos } from "../../interfaces/index.js";
import { inspectJson, inspectSummary } from "./inspect-key.js";

// Freeze the timestamp-bearing metadata so snapshots are stable.
const stable = (key: IKryptos): IKryptos =>
  KryptosKit.clone(key, {
    createdAt: new Date("2026-01-01T00:00:00Z"),
    notBefore: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2051-01-01T00:00:00Z"),
  });

const FIXTURES: Array<[string, IKryptos]> = [
  ["EC", KRYPTOS_EC_SIG_ES256],
  ["OKP", KRYPTOS_OKP_SIG_ED25519],
  ["RSA", KRYPTOS_RSA_SIG_RS256],
  ["oct", KRYPTOS_OCT_SIG_HS256],
  ["AKP", KRYPTOS_AKP_SIG_ML_DSA_44],
];

// Secret material that must never appear in any rendered output.
const secretStrings = (key: IKryptos): Array<string> => {
  const jwk = key.toJWK("private") as Record<string, string | undefined>;
  return ["d", "k", "priv", "p", "q", "dp", "dq", "qi"]
    .map((member) => jwk[member])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
};

describe("inspectSummary / inspectJson", () => {
  test.each(FIXTURES)("summary snapshot: %s", (_name, fixture) => {
    expect(inspectSummary(stable(fixture))).toMatchSnapshot();
  });

  test.each(FIXTURES)("never prints secret bytes: %s", (_name, fixture) => {
    const summary = inspectSummary(fixture);
    const json = inspectJson(fixture);

    for (const secret of secretStrings(fixture)) {
      expect(summary).not.toContain(secret);
      expect(json).not.toContain(secret);
    }
  });

  test("json redacts secret members with <n bytes> markers", () => {
    const json = JSON.parse(inspectJson(KRYPTOS_RSA_SIG_RS256)) as Record<
      string,
      unknown
    >;

    expect(json.d).toMatch(/^<\d+ bytes>$/);
    expect(json.p).toMatch(/^<\d+ bytes>$/);
    // public material is not redacted
    expect(typeof json.n).toBe("string");
    expect(json.n).not.toMatch(/bytes>/);
  });

  test("renders full certificate details for a ca-signed 2-cert chain (snapshot)", () => {
    const notBefore = new Date("2026-01-01T00:00:00Z");
    const ca = KryptosKit.generate.auto({
      algorithm: "ES384",
      id: "key_rootca00000000",
      notBefore,
      expiresAt: new Date("2046-01-01T00:00:00Z"),
      certificate: {
        mode: "root-ca",
        subject: "Lindorm Root CA",
        organization: "Lindorm",
        pathLengthConstraint: 1,
      },
    });
    const leaf = KryptosKit.generate.auto({
      algorithm: "ES256",
      id: "key_leaf000000000",
      createdAt: notBefore,
      notBefore,
      expiresAt: new Date("2036-01-01T00:00:00Z"),
      certificate: {
        mode: "ca-signed",
        ca,
        subject: "tyr.lindorm.io",
        organization: "Lindorm",
        subjectAlternativeNames: [{ type: "dns", value: "tyr.lindorm.io" }],
      },
    });

    const summary = inspectSummary(leaf);

    // Key material is random per generation, so redact the material-derived
    // fields (thumbprint, x5t#S256, serial); the snapshot then locks the
    // certificate STRUCTURE — subject/issuer/validity/CA flags/keyUsage/SANs.
    const redacted = summary
      .replace(/serial +[0-9a-f]+/g, "serial      <hex>")
      .replace(/thumbprint +\S+/g, "thumbprint   <thumb>")
      .replace(/x5t#S256 +\S+/g, "x5t#S256     <thumb>");

    expect(redacted).toMatchSnapshot();

    // Structural assertions independent of the snapshot.
    expect(summary).toContain("CN=tyr.lindorm.io, O=Lindorm");
    expect(summary).toContain("CN=Lindorm Root CA, O=Lindorm");
    expect(summary).toContain("CA=true, pathLen=1");
    expect(summary).toContain("CA=false");
    expect(summary).toContain("2026-01-01T00:00:00.000Z → 2036-01-01T00:00:00.000Z");
  });
});
