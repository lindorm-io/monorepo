import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type { ProfileContentFor, ProfileMintOptions } from "../../types/index.js";
import type { BuiltInProfiles } from "./built-in-profiles.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";
const CLIENT = "client-1";

/**
 * THE MEDIA TYPE EACH BUILT-IN PROFILE STAMPS.
 *
 * RFC 8725 §3.11 recommends explicit typing so a token issued for one purpose
 * cannot be replayed where another is expected, and each profile's media type is
 * the concrete form of that: `a-profile-refuses-a-token-typed-as-another-kind`
 * in the conformance table states that the type is CHECKED, and this states WHAT
 * each profile's type is. Both are needed — a check against a value nothing pins
 * would keep working after the value silently changed, and every deployed
 * relying party matching on the old string would start refusing our tokens.
 *
 * ⚠ The expected strings are FROZEN LITERALS, not read off the descriptors. A
 * table derived from the registry would compare the registry to itself and pass
 * over any change to it; these are the values other implementations match on, so
 * they are written out and a change to one is a deliberate edit here.
 *
 * ⚠ TOTAL over `keyof BuiltInProfiles`, so a twelfth profile is a compile error
 * rather than a profile whose type nothing states.
 *
 * ⚠ Not a conformance row: the table states ONE capability per row and this is
 * eleven values of the same one, bound to a collection by its own type. Beside
 * the registry is where the collection lives.
 */
type Expectation<P extends keyof BuiltInProfiles> =
  | {
      mints: true;
      /** The exact `typ` header value a token of this profile carries. */
      typ: string;
      content: ProfileContentFor<P>;
      options?: ProfileMintOptions;
    }
  | { mints: false; reason: string };

const EVENTS = { "urn:lindorm:event:test": {} };

const PROFILE_TYP: { [P in keyof BuiltInProfiles]-?: Expectation<P> } = {
  // RFC 9068 §2.1 — "JWT access tokens MUST include this media type in the `typ`
  // header parameter to explicitly declare that the JWT represents an access
  // token complying with this profile."
  access_token: {
    mints: true,
    typ: "application/at+jwt",
    content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
  },

  // `default` mandates no type of its own, so the caller's `tokenType` is what
  // the media type is built from — the fallback that keeps every token typed.
  default: {
    mints: true,
    typ: "application/test_token+jwt",
    content: { subject: "user-1", expires: "1h", tokenType: "test_token" },
  },

  delegation: {
    mints: true,
    typ: "application/delegation+jwt",
    content: { issuer: CLIENT, subject: "customer-sub", audience: [ISSUER] },
  },

  erasure_token: {
    mints: true,
    typ: "application/erasure+jwt",
    content: {
      audience: [CLIENT],
      subject: "user-1",
      events: { "urn:lindorm:event:rtbf": { rtbf_request_id: "r-1" } },
    },
  },

  external_access_token: {
    mints: false,
    reason:
      'The profile declares `use: "verify"` — it exists to check a third party\'s token, so there is no token of ours to stamp. Its refusal to mint is stated in the conformance table.',
  },

  // OIDC Core §2 defines the ID Token as a JWT and adds no media type of its own,
  // so the bare conventional `JWT` is the conformant answer.
  id_token: {
    mints: true,
    typ: "JWT",
    content: { subject: "user-1", audience: [CLIENT] },
    options: { context: { accessTokenIssued: false } },
  },

  introspection: {
    mints: true,
    typ: "application/token-introspection+jwt",
    content: {
      audience: [RESOURCE],
      claims: { token_introspection: { active: true } },
    },
  },

  jarm: {
    mints: true,
    typ: "JWT",
    content: { audience: [CLIENT], claims: { code: "abc", state: "xyz" } },
  },

  logout_token: {
    mints: true,
    typ: "application/logout+jwt",
    content: {
      audience: [CLIENT],
      subject: "user-1",
      sessionId: "sess-1",
      events: { "http://schemas.openid.net/event/backchannel-logout": {} },
    },
  },

  security_event: {
    mints: true,
    typ: "application/secevent+jwt",
    content: {
      audience: ["https://receiver.lindorm.io/"],
      subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
      events: EVENTS,
    },
  },

  userinfo: {
    mints: true,
    typ: "JWT",
    content: { subject: "user-1", audience: [CLIENT] },
  },
};

describe("the media type each built-in profile stamps", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  const entries = Object.entries(PROFILE_TYP) as Array<
    [keyof BuiltInProfiles, Expectation<keyof BuiltInProfiles>]
  >;

  // Without this the `test.each` below would pass over an emptied table.
  test("states one expectation per built-in profile", () => {
    expect(entries.length).toBe(11);
  });

  test.each(entries.filter(([, entry]) => entry.mints))("%s", async (name, entry) => {
    if (entry.mints === false) throw new Error("unreachable — filtered above");

    // The ONE cast, and it costs nothing: `content` is correlated with the
    // profile NAME per table member, but at this call site `name` is the whole
    // union and TypeScript cannot carry that correlation into `mint<P>`. The
    // table itself is still checked against its own member.
    const { token } = await aegis.mint(name, entry.content as never, entry.options);

    expect(JwtKit.decode(token).protectedHeader.typ).toBe(entry.typ);
  });
});
