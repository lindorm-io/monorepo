import { baseParse } from "@lindorm-io/core";
import {
  createTestKeyPairEC,
  createTestKeyPairHS,
  createTestKeyPairRSA,
  createTestKeystore,
} from "@lindorm-io/key-pair";
import MockDate from "mockdate";
import { TokenError } from "../error";
import { createTestJwt } from "../mocks";
import { JwtSignOptions } from "../types";
import { getUnixTime } from "../util/private";
import { JWT } from "./JWT";

MockDate.set("2021-01-01T08:00:00.000Z");

const parseTokenData = (token: string): any => JSON.parse(baseParse(token.split(".")[1]));

describe("JWT", () => {
  let jwt: JWT;
  let optionsMin: JwtSignOptions<any>;
  let optionsFull: JwtSignOptions<any>;

  beforeEach(() => {
    optionsMin = {
      audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
      expiry: "10 seconds",
      subject: "c3e1b21a-0556-4b61-8805-60627028536f",
      type: "id_token",
    };
    optionsFull = {
      id: "d2457602-63bd-48c5-a19f-bfd81bf870c0",
      adjustedAccessLevel: 3,
      atHash: "aa08b86a3550489380219a18efcd1532",
      audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
      authContextClass: "loa_4",
      authMethodsReference: ["email"],
      authorizedParty: "13480815-309a-4b7c-b8e7-325ff76fd150",
      authTime: getUnixTime(new Date()),
      claims: { claimsKey: "claimValue" },
      client: "88e3b5f5-5c49-45ef-a064-a2d39c11ee0c",
      expiry: "10 seconds",
      jwksUrl: "https://test.lindorm.io/.well-known/jwks.json",
      levelOfAssurance: 4,
      nonce: "bed190d568a5456bb15a39cf71d72022",
      notBefore: new Date(),
      scopes: ["openid"],
      session: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
      sessionHint: "refresh",
      subject: "c3e1b21a-0556-4b61-8805-60627028536f",
      subjectHint: "identity",
      tenant: "d4d0aa3b-e7f3-494b-87d0-cdfed3514788",
      type: "id_token",
      username: "princejonn",
    };
    jwt = createTestJwt({
      jwksUrl: "https://default.lindorm.io/.well-known/jwks.json",
    });
  });

  afterEach(jest.clearAllMocks);

  describe("ES", () => {
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
          claims: expect.objectContaining({
            audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
            subject: "c3e1b21a-0556-4b61-8805-60627028536f",
          }),
          metadata: expect.objectContaining({
            algorithm: "ES512",
            type: "id_token",
          }),
          token,
        }),
      );
    });
  });

  describe("HS", () => {
    beforeEach(() => {
      jwt = createTestJwt(
        undefined,
        createTestKeystore({
          keys: [createTestKeyPairHS()],
        }),
      );
    });

    test("should sign/verify", () => {
      const { id, token } = jwt.sign(optionsMin);

      expect(jwt.verify(token)).toStrictEqual(
        expect.objectContaining({
          id,
          claims: expect.objectContaining({
            audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
            subject: "c3e1b21a-0556-4b61-8805-60627028536f",
          }),
          metadata: expect.objectContaining({
            algorithm: "HS512",
            type: "id_token",
          }),
          token,
        }),
      );
    });
  });

  describe("RSA", () => {
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
          claims: expect.objectContaining({
            audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
            subject: "c3e1b21a-0556-4b61-8805-60627028536f",
          }),
          metadata: expect.objectContaining({
            algorithm: "RS512",
            type: "id_token",
          }),
          token,
        }),
      );
    });
  });

  describe("createHash", () => {
    test("should create hash", () => {
      expect(
        jwt.createHash(
          "OqqGKbIQmFZEmygaoBtlAhKhJIjKPcUNHVfhAsmAQtQpExmmtJUnxPtTWFcwnUKvEKoAEScAKVkjGrtOjjGwPJLStjEjouUuBPQrNXWCLIQcYMhGauPQkOKvNEhlKoQSscvmLKNDMHYFIjeVEutruVojWmuSXDsWHiVjqQzXhPZICuhwitAxWWlDBAyWbohxAHnMeUAsatJGuNdCWciiPBiQyVhNrtnmXsUvGRIyRihPjWTGKKHVFnmgNDMNJswm",
        ),
      ).toBe("6424l6RHpQH3c6u8vDKCdpPRWM55EYgvwhplokwqATaXs0ngACNuRsEQb5ERFp8T");
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
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        kid: "7531da89-12e9-403e-925a-5da49100635c",
        typ: "JWT",
      },
      payload: {
        aal: 3,
        acr: "loa_4",
        amr: ["email"],
        at_hash: "aa08b86a3550489380219a18efcd1532",
        aud: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
        auth_time: 1609488000,
        azp: "13480815-309a-4b7c-b8e7-325ff76fd150",
        cid: "88e3b5f5-5c49-45ef-a064-a2d39c11ee0c",
        claims_key: "claimValue",
        exp: 1609488010,
        iat: 1609488000,
        iss: "https://test.lindorm.io",
        jti: id,
        loa: 4,
        nbf: 1609488000,
        nonce: "bed190d568a5456bb15a39cf71d72022",
        scope: "openid",
        sid: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
        sih: "refresh",
        sub: "c3e1b21a-0556-4b61-8805-60627028536f",
        suh: "identity",
        tid: "d4d0aa3b-e7f3-494b-87d0-cdfed3514788",
        token_type: "id_token",
        usr: "princejonn",
      },
      signature: expect.any(String),
    });
  });

  test("should decode minimum signed values", () => {
    const { id, token } = jwt.sign(optionsMin);

    expect(JWT.decode(token)).toStrictEqual({
      header: {
        alg: "ES512",
        jku: "https://default.lindorm.io/.well-known/jwks.json",
        kid: "7531da89-12e9-403e-925a-5da49100635c",
        typ: "JWT",
      },
      payload: {
        aud: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
        exp: 1609488010,
        iat: 1609488000,
        iss: "https://test.lindorm.io",
        jti: id,
        nbf: 1609488000,
        sub: "c3e1b21a-0556-4b61-8805-60627028536f",
        token_type: "id_token",
      },
      signature: expect.any(String),
    });
  });

  test("should decode and format", () => {
    const { id, token } = jwt.sign(optionsFull);

    expect(JWT.decodePayload(token)).toStrictEqual({
      id,
      claims: {
        adjustedAccessLevel: 3,
        audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
        authContextClass: "loa_4",
        authMethodsReference: ["email"],
        authorizedParty: "13480815-309a-4b7c-b8e7-325ff76fd150",
        claimsKey: "claimValue",
        client: "88e3b5f5-5c49-45ef-a064-a2d39c11ee0c",
        levelOfAssurance: 4,
        scopes: ["openid"],
        session: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
        subject: "c3e1b21a-0556-4b61-8805-60627028536f",
        tenant: "d4d0aa3b-e7f3-494b-87d0-cdfed3514788",
        username: "princejonn",
      },
      metadata: {
        active: true,
        algorithm: "ES512",
        atHash: "aa08b86a3550489380219a18efcd1532",
        authTime: 1609488000,
        expires: 1609488010,
        expiresIn: 10,
        issuedAt: 1609488000,
        issuer: "https://test.lindorm.io",
        jwksUrl: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "7531da89-12e9-403e-925a-5da49100635c",
        nonce: "bed190d568a5456bb15a39cf71d72022",
        notBefore: 1609488000,
        now: 1609488000,
        sessionHint: "refresh",
        subjectHint: "identity",
        type: "id_token",
      },
      token,
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
        audience: "066576d7-9bb5-4e08-83c7-e9c4e81bc108",
      }),
    ).toBeTruthy();
  });

  test("should verify client", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        client: "88e3b5f5-5c49-45ef-a064-a2d39c11ee0c",
      }),
    ).toBeTruthy();
  });

  test("should verify issuer", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        issuer: "https://test.lindorm.io",
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
        scopes: ["openid"],
      }),
    ).toBeTruthy();
  });

  test("should verify session", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        session: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
      }),
    ).toBeTruthy();
  });

  test("should verify subject", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        subject: "c3e1b21a-0556-4b61-8805-60627028536f",
      }),
    ).toBeTruthy();
  });

  test("should verify subject hints", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        subjectHints: ["identity", "client"],
      }),
    ).toBeTruthy();
  });

  test("should verify tenant", () => {
    const { token } = jwt.sign(optionsFull);

    expect(() =>
      jwt.verify(token, {
        tenant: "d4d0aa3b-e7f3-494b-87d0-cdfed3514788",
      }),
    ).toBeTruthy();
  });

  test("should verify types", () => {
    const { token } = jwt.sign(optionsFull);

    expect(
      jwt.verify(token, {
        types: ["other", "extra", "id_token"],
      }),
    ).toBeTruthy();
  });

  test("should return all signed values", () => {
    const { id, token } = jwt.sign(optionsFull);

    expect(jwt.verify(token)).toStrictEqual({
      id,
      claims: {
        adjustedAccessLevel: 3,
        audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
        authContextClass: "loa_4",
        authMethodsReference: ["email"],
        authorizedParty: "13480815-309a-4b7c-b8e7-325ff76fd150",
        claimsKey: "claimValue",
        client: "88e3b5f5-5c49-45ef-a064-a2d39c11ee0c",
        levelOfAssurance: 4,
        scopes: ["openid"],
        session: "ff33e1bb-56ce-47bb-ad23-137897fc97ff",
        subject: "c3e1b21a-0556-4b61-8805-60627028536f",
        tenant: "d4d0aa3b-e7f3-494b-87d0-cdfed3514788",
        username: "princejonn",
      },
      metadata: {
        active: true,
        algorithm: "ES512",
        atHash: "aa08b86a3550489380219a18efcd1532",
        authTime: 1609488000,
        expires: 1609488010,
        expiresIn: 10,
        issuedAt: 1609488000,
        issuer: "https://test.lindorm.io",
        jwksUrl: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "7531da89-12e9-403e-925a-5da49100635c",
        nonce: "bed190d568a5456bb15a39cf71d72022",
        notBefore: 1609488000,
        now: 1609488000,
        sessionHint: "refresh",
        subjectHint: "identity",
        type: "id_token",
      },
      token,
    });
  });

  test("should return default values", () => {
    const { id, token } = jwt.sign(optionsMin);

    expect(jwt.verify(token)).toStrictEqual({
      id,
      claims: {
        adjustedAccessLevel: 0,
        audiences: ["066576d7-9bb5-4e08-83c7-e9c4e81bc108"],
        authContextClass: null,
        authMethodsReference: [],
        authorizedParty: null,
        client: null,
        levelOfAssurance: 0,
        scopes: [],
        session: null,
        subject: "c3e1b21a-0556-4b61-8805-60627028536f",
        tenant: null,
        username: null,
      },
      metadata: {
        active: true,
        algorithm: "ES512",
        atHash: null,
        authTime: null,
        expires: 1609488010,
        expiresIn: 10,
        issuedAt: 1609488000,
        issuer: "https://test.lindorm.io",
        jwksUrl: "https://default.lindorm.io/.well-known/jwks.json",
        keyId: "7531da89-12e9-403e-925a-5da49100635c",
        nonce: null,
        notBefore: 1609488000,
        now: 1609488000,
        sessionHint: null,
        subjectHint: null,
        type: "id_token",
      },
      token,
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
        case_one: 1,
        case_two: "two",
        case_three: { nested_one: "one", nested_two: 2 },
        case_four: ["array", "data"],
        case_five: true,
      }),
    );

    expect(jwt.verify(token)).toStrictEqual(
      expect.objectContaining({
        claims: expect.objectContaining({
          caseOne: 1,
          caseTwo: "two",
          caseThree: { nestedOne: "one", nestedTwo: 2 },
          caseFour: ["array", "data"],
          caseFive: true,
        }),
      }),
    );
  });

  test("should accept string as expiry", () => {
    const { token } = jwt.sign({
      audiences: optionsFull.audiences,
      expiry: "10 seconds",
      subject: optionsFull.subject,
      type: "id_token",
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
      type: "id_token",
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
      type: "id_token",
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
