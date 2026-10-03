import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import {
  signAsThirdParty,
  signContentAsThirdParty,
} from "../../__fixtures__/third-party-producer.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
afterAll(() => MockDate.reset());

const ISSUER = "https://test.lindorm.io/";
const NOW = 1704096000;

const CLAIMS = {
  iss: ISSUER,
  sub: "user-1",
  exp: NOW + 3600,
  iat: NOW,
  jti: "token-1",
};

/** Every non-string a JSON header can carry under a byte parameter. */
const NOT_STRINGS: ReadonlyArray<[shape: string, value: unknown]> = [
  ["the number 5", 5],
  ["the number 0", 0],
  ["true", true],
  ["false", false],
  ["null", null],
  ["an object", { bytes: "AAAA" }],
  ["an array", ["AAAA"]],
];

/** The three byte parameters, each carrying the same value. */
const byteParameters = (value: unknown): Dict => ({ iv: value, tag: value, p2s: value });

/**
 * A signed JOSE token names no key-management algorithm, so no reader understands
 * its byte parameters (RFC 7515 §4). The domain header types each `string` and
 * reports one only when it is one; the raw doors report the wire header as the
 * producer wrote it.
 */
describe("a signed JOSE token carrying byte header parameters that are not strings", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora: IAmphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);

    aegis = new Aegis({ amphora, logger });
  });

  const jwt = (value: unknown): Promise<string> =>
    signAsThirdParty("jose", CLAIMS, "JWT", TEST_EC_KEY_SIG, {
      protectedHeader: byteParameters(value),
    });

  const jws = (value: unknown): Promise<string> =>
    signContentAsThirdParty("jose", Buffer.from("content"), "JWS", TEST_EC_KEY_SIG, {
      protectedHeader: byteParameters(value),
    });

  /** Each door, and the one header it reports. */
  type Door = [door: string, header: (value: unknown) => Promise<unknown>];

  const DOMAIN_DOORS: ReadonlyArray<Door> = [
    ["aegis.parse of a JWT", async (value) => aegis.parse(await jwt(value)).header],
    [
      "aegis.verify of a JWT",
      async (value) => (await aegis.verify(await jwt(value))).header,
    ],
    [
      "aegis.verify of a JWS",
      async (value) => (await aegis.verify(await jws(value))).header,
    ],
  ];

  const RAW_DOORS: ReadonlyArray<Door> = [
    [
      "aegis.jwt.verify",
      async (value) => (await aegis.jwt.verify(await jwt(value))).header,
    ],
    [
      "aegis.jws.verify",
      async (value) => (await aegis.jws.verify(await jws(value))).header,
    ],
  ];

  describe.each(DOMAIN_DOORS)("at %s", (_door, header) => {
    test.each(NOT_STRINGS)(
      "reports no byte parameter that is %s",
      async (_shape, value) => {
        expect(await header(value)).toMatchSnapshot();
      },
    );

    test("reports a byte parameter that is a string", async () => {
      expect(await header("AAAAAAAAAAAAAAAA")).toMatchSnapshot();
    });
  });

  describe.each(RAW_DOORS)("at %s", (_door, header) => {
    test.each(NOT_STRINGS)(
      "reports a byte parameter that is %s as the producer wrote it",
      async (_shape, value) => {
        expect(await header(value)).toMatchSnapshot();
      },
    );
  });
});
