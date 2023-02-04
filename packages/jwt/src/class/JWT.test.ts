import MockDate from "mockdate";
import { JWT } from "./JWT";
import { JwtSignOptions } from "../types";
import { TokenError } from "../error";
import { baseParse } from "@lindorm-io/core";
import { createTestJwt } from "../mocks";
import { getUnixTime } from "../util/private";
import {
  createTestKeyPairEC,
  createTestKeyPairRSA,
  createTestKeystore,
} from "@lindorm-io/key-pair";

MockDate.set("2021-01-01T08:00:00.000Z");

const parseTokenData = (token: string): any => JSON.parse(baseParse(token.split(".")[1]));

describe("JWT", () => {
  let jwt: JWT;
  let optionsMin: JwtSignOptions<any, any>;
  let optionsFull: JwtSignOptions<any, any>;

  beforeEach(() => {
    optionsMin = {
      audiences: ["audience"],
      expiry: "10 seconds",
      subject: "subject",
      type: "type",
    };
    optionsFull = {
      id: "d2457602-63bd-48c5-a19f-bfd81bf870c0",
      adjustedAccessLevel: 3,
      audiences: ["audience"],
      authContextClass: ["acr"],
      authMethodsReference: ["amr"],
      authTime: getUnixTime(new Date()),
      authorizedParty: "13480815-309a-4b7c-b8e7-325ff76fd150",
      claims: { claimsKey: "claimValue" },
      expiry: "10 seconds",
      levelOfAssurance: 4,
      nonce: "bed190d568a5456bb15a39cf71d72022",
      notBefore: new Date(),
      payload: { payloadKey: "payloadValue" },
      scopes: ["scope"],
      sessionId: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
      sessionHint: "sessionHint",
      subject: "subject",
      subjectHint: "subjectHint",
      type: "type",
      username: "username",
    };
    jwt = createTestJwt();
  });

  afterEach(jest.clearAllMocks);

  describe("RS512", () => {
    beforeEach(() => {
      jwt = createTestJwt(
        undefined,
        createTestKeystore({
          keys: [createTestKeyPairRSA()],
        }),
      );
    });

    test("should sign/verify", () => {
      const { id, token } = jwt.sign(optionsMin);

      expect(jwt.verify(token)).toStrictEqual(
        expect.objectContaining({
          id,
          token,
          audiences: ["audience"],
          subject: "subject",
          type: "type",
        }),
      );
    });
  });

  describe("ES512", () => {
    beforeEach(() => {
      jwt = createTestJwt(
        undefined,
        createTestKeystore({
          keys: [createTestKeyPairEC()],
        }),
      );
    });

    test("should sign/verify", () => {
      const { id, token } = jwt.sign(optionsMin);

      expect(jwt.verify(token)).toStrictEqual(
        expect.objectContaining({
          id,
          token,
          audiences: ["audience"],
          subject: "subject",
          type: "type",
        }),
      );
    });
  });

  test("should create", () => {
    expect(jwt.sign(optionsMin)).toStrictEqual({
      id: expect.any(String),
      expires: expect.any(Date),
      expiresIn: 10,
      expiresUnix: 1609488010,
      token: expect.any(String),
    });
  });

  test("should decode full values", () => {
    const { id, token } = jwt.sign(optionsFull);

    expect(JWT.decode(token)).toStrictEqual({
      header: {
        alg: "ES512",
        kid: "7531da89-12e9-403e-925a-5da49100635c",
        typ: "JWT",
      },
      payload: {
        aal: 3,
        acr: ["acr"],
        amr: ["amr"],
        aud: ["audience"],
        auth_time: 1609488000,
        azp: "13480815-309a-4b7c-b8e7-325ff76fd150",
        claims_key: "claimValue",
        exp: 1609488010,
        ext: {
          payload_key: "payloadValue",
        },
        iat: 1609488000,
        iss: "issuer",
        jti: id,
        loa: 4,
        nbf: 1609488000,
        nonce: "bed190d568a5456bb15a39cf71d72022",
        scp: ["scope"],
        sid: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
        sih: "sessionHint",
        sub: "subject",
        suh: "subjectHint",
        token_type: "type",
        usr: "username",
      },
      signature: expect.any(String),
    });
  });

  test("should decode minimum signed values", () => {
    const { id, token } = jwt.sign(optionsMin);

    expect(JWT.decode(token)).toStrictEqual({
      header: {
        alg: "ES512",
        kid: "7531da89-12e9-403e-925a-5da49100635c",
        typ: "JWT",
      },
      payload: {
        aud: ["audience"],
        exp: 1609488010,
        iat: 1609488000,
        iss: "issuer",
        jti: id,
        nbf: 1609488000,
        sub: "subject",
        token_type: "type",
      },
      signature: expect.any(String),
    });
  });

  test("should decode and format", () => {
    const { id, token } = jwt.sign(optionsFull);

    expect(JWT.decodeFormatted(token)).toStrictEqual({
      id,
      active: true,
      adjustedAccessLevel: 3,
      audiences: ["audience"],
      authContextClass: ["acr"],
      authMethodsReference: ["amr"],
      authTime: 1609488000,
      authorizedParty: "13480815-309a-4b7c-b8e7-325ff76fd150",
      claims: { claimsKey: "claimValue" },
      expires: 1609488010,
      expiresIn: 10,
      issuedAt: 1609488000,
      issuer: "issuer",
      keyId: "7531da89-12e9-403e-925a-5da49100635c",
      levelOfAssurance: 4,
      nonce: "bed190d568a5456bb15a39cf71d72022",
      notBefore: 1609488000,
      now: 1609488000,
      payload: { payloadKey: "payloadValue" },
      scopes: ["scope"],
      sessionId: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
      sessionHint: "sessionHint",
      subject: "subject",
      subjectHint: "subjectHint",
      type: "type",
      username: "username",
    });
  });

  test("should verify adjusted access level", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        adjustedAccessLevel: 3,
      }),
    ).toBeTruthy();
  });

  test("should verify audience", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        audience: "audience",
      }),
    ).toBeTruthy();
  });

  test("should verify audiences", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        audiences: ["audience"],
      }),
    ).toBeTruthy();
  });

  test("should verify issuer", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        issuer: "issuer",
      }),
    ).toBeTruthy();
  });

  test("should verify max age", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        maxAge: "90 minutes",
      }),
    ).toBeTruthy();
  });

  test("should verify nonce", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        nonce: "bed190d568a5456bb15a39cf71d72022",
      }),
    ).toBeTruthy();
  });

  test("should verify level of assurance", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        levelOfAssurance: 3,
      }),
    ).toBeTruthy();
  });

  test("should verify scopes", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        scopes: ["scope"],
      }),
    ).toBeTruthy();
  });

  test("should verify subject", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        subject: "subject",
      }),
    ).toBeTruthy();
  });

  test("should verify subjects", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        subjects: ["subject", "extra", "other"],
      }),
    ).toBeTruthy();
  });

  test("should verify subject hint", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        subjectHint: "subjectHint",
      }),
    ).toBeTruthy();
  });

  test("should verify types", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        types: ["other", "extra", "type"],
      }),
    ).toBeTruthy();
  });

  test("should return all signed values", () => {
    const { id, token } = jwt.sign(optionsFull);

    expect(jwt.verify(token)).toStrictEqual({
      id,
      active: true,
      adjustedAccessLevel: 3,
      audiences: ["audience"],
      authContextClass: ["acr"],
      authMethodsReference: ["amr"],
      authTime: 1609488000,
      authorizedParty: "13480815-309a-4b7c-b8e7-325ff76fd150",
      claims: { claimsKey: "claimValue" },
      expires: 1609488010,
      expiresIn: 10,
      issuedAt: 1609488000,
      issuer: "issuer",
      levelOfAssurance: 4,
      nonce: "bed190d568a5456bb15a39cf71d72022",
      notBefore: 1609488000,
      now: 1609488000,
      payload: { payloadKey: "payloadValue" },
      scopes: ["scope"],
      sessionId: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
      sessionHint: "sessionHint",
      subject: "subject",
      subjectHint: "subjectHint",
      token: expect.any(String),
      type: "type",
      username: "username",
    });
  });

  test("should return default values", () => {
    const { id, token } = jwt.sign(optionsMin);

    expect(jwt.verify(token)).toStrictEqual({
      id: id,
      active: true,
      adjustedAccessLevel: 0,
      audiences: ["audience"],
      authContextClass: [],
      authMethodsReference: [],
      authTime: null,
      authorizedParty: null,
      claims: {},
      expires: 1609488010,
      expiresIn: 10,
      issuedAt: 1609488000,
      issuer: "issuer",
      levelOfAssurance: 0,
      nonce: null,
      notBefore: 1609488000,
      now: 1609488000,
      payload: {},
      scopes: [],
      sessionId: null,
      sessionHint: null,
      subject: "subject",
      subjectHint: null,
      token: token,
      type: "type",
      username: null,
    });
  });

  test("should store token claims in snake_case and decode to camelCase", () => {
    const { token } = jwt.sign({
      ...optionsMin,
      claims: {
        caseOne: 1,
        caseTwo: "two",
        caseThree: { nestedOne: "one", nested_two: 2 },
        case_four: ["array", "data"],
        caseFive: true,
      },
    });

    expect(parseTokenData(token)).toStrictEqual(
      expect.objectContaining({
        case_five: true,
        case_four: ["array", "data"],
        case_one: 1,
        case_three: { nested_one: "one", nested_two: 2 },
        case_two: "two",
      }),
    );

    expect(jwt.verify(token)).toStrictEqual(
      expect.objectContaining({
        claims: {
          caseFive: true,
          caseFour: ["array", "data"],
          caseOne: 1,
          caseThree: { nestedOne: "one", nestedTwo: 2 },
          caseTwo: "two",
        },
      }),
    );
  });

  test("should store token payload in snake_case and decode to camelCase", () => {
    const { token } = jwt.sign({
      ...optionsMin,
      payload: {
        caseOne: 1,
        caseTwo: "two",
        caseThree: { nestedOne: "one", nested_two: 2 },
        case_four: ["array", "data"],
        caseFive: true,
      },
    });

    expect(parseTokenData(token)).toStrictEqual(
      expect.objectContaining({
        ext: {
          case_five: true,
          case_four: ["array", "data"],
          case_one: 1,
          case_three: { nested_one: "one", nested_two: 2 },
          case_two: "two",
        },
      }),
    );

    expect(jwt.verify(token)).toStrictEqual(
      expect.objectContaining({
        payload: {
          caseFive: true,
          caseFour: ["array", "data"],
          caseOne: 1,
          caseThree: { nestedOne: "one", nestedTwo: 2 },
          caseTwo: "two",
        },
      }),
    );
  });

  test("should accept string as expiry", () => {
    const { token } = jwt.sign({
      audiences: optionsFull.audiences,
      expiry: "10 seconds",
      subject: optionsFull.subject,
      type: "type",
    });

    expect(parseTokenData(token)).toStrictEqual(
      expect.objectContaining({
        exp: 1609488010,
        iat: 1609488000,
        nbf: 1609488000,
      }),
    );
  });

  test("should accept number as expiry", () => {
    const { token } = jwt.sign({
      audiences: optionsFull.audiences,
      expiry: 1609488010,
      subject: optionsFull.subject,
      type: "type",
    });

    expect(parseTokenData(token)).toStrictEqual(
      expect.objectContaining({
        exp: 1609488010,
        iat: 1609488000,
        nbf: 1609488000,
      }),
    );
  });

  test("should accept Date as expiry", () => {
    const { token } = jwt.sign({
      audiences: optionsFull.audiences,
      expiry: new Date("2021-12-12 12:00:00"),
      subject: optionsFull.subject,
      type: "type",
    });

    expect(parseTokenData(token)).toStrictEqual(
      expect.objectContaining({
        exp: 1639310400,
        iat: 1609488000,
        nbf: 1609488000,
      }),
    );
  });

  test("should reject missing scope", () => {
    const { token } = jwt.sign({ ...optionsFull, scopes: [] });

    expect(() =>
      jwt.verify(token, {
        scopes: ["unexpected"],
      }),
    ).toThrow(TokenError);
  });

  test("should reject invalid scope", () => {
    const { token } = jwt.sign(optionsFull);

    expect(() =>
      jwt.verify(token, {
        scopes: ["unexpected"],
      }),
    ).toThrow(TokenError);
  });

  test("should reject invalid type", () => {
    const { token } = jwt.sign(optionsFull);

    expect(() =>
      jwt.verify(token, {
        types: ["wrong-type"],
      }),
    ).toThrow(TokenError);
  });

  test("should reject expired", () => {
    const { token } = jwt.sign({
      ...optionsFull,
      expiry: new Date("2021-01-01T08:10:00.000Z"),
    });

    MockDate.set("2022-01-01T08:10:00.000Z");

    expect(() => jwt.verify(token)).toThrow(TokenError);

    MockDate.set("2021-01-01T08:00:00.000Z");
  });

  test("should not reject expired when clock tolerance is enabled", () => {
    const { token } = jwt.sign({
      ...optionsFull,
      expiry: new Date("2021-01-01T08:10:00.000Z"),
    });

    MockDate.set("2021-01-01T08:10:04.999Z");

    expect(jwt.verify(token, { clockTolerance: 5 })).toBeTruthy();

    MockDate.set("2021-01-01T08:00:00.000Z");
  });

  test("should reject token not yet valid", () => {
    const { token } = jwt.sign({
      ...optionsFull,
      notBefore: new Date("2021-01-01T09:00:00.000Z"),
      expiry: new Date("2021-01-01T10:00:00.000Z"),
    });

    MockDate.set("2022-01-01T08:30:00.000Z");

    expect(() => jwt.verify(token)).toThrow(TokenError);

    MockDate.set("2021-01-01T08:00:00.000Z");
  });
});
