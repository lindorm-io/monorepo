import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { PylonCookieConfig, PylonSetCookie } from "../../types/index.js";
import { signCookie as _signCookie } from "../utils/cookies/sign-cookie.js";
import { verifyCookie as _verifyCookie } from "../utils/cookies/verify-cookie.js";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware.js";

vi.mock("../utils/cookies/sign-cookie.js");
vi.mock("../utils/cookies/verify-cookie.js");

const signCookie = _signCookie as Mock;
const verifyCookie = _verifyCookie as Mock;

type SetCall = { name: string; value: unknown; options?: PylonSetCookie };

const buildCtx = (cookieHeader: string) => ({
  aegis: createMockAegis(),
  amphora: createMockAmphora(),
  get: vi.fn().mockReturnValue(cookieHeader),
  set: vi.fn(),
});

const extractNameValueOnly = (setCookieHeader: string): string => {
  const semicolonIdx = setCookieHeader.indexOf(";");
  return (
    semicolonIdx === -1 ? setCookieHeader : setCookieHeader.slice(0, semicolonIdx)
  ).trim();
};

const headersToCookieHeader = (headers: Array<string>): string =>
  headers.map(extractNameValueOnly).join("; ");

type RunRoundTripResult<T> = {
  setHeaders: Array<string>;
  cookieHeader: string;
  read: T | null;
  writeCtx: ReturnType<typeof buildCtx>;
  readCtx: ReturnType<typeof buildCtx>;
};

const runRoundTrip = async <T = unknown>(
  config: PylonCookieConfig,
  sets: Array<SetCall>,
  reads: Array<{ name: string; options?: PylonSetCookie }>,
): Promise<{
  setHeaders: Array<string>;
  cookieHeader: string;
  reads: Array<T | null>;
  writeCtx: ReturnType<typeof buildCtx>;
  readCtx: ReturnType<typeof buildCtx>;
}> => {
  const writeCtx = buildCtx("");
  const writeMiddleware = createHttpCookiesMiddleware(config);

  await writeMiddleware(writeCtx as any, async () => {
    for (const { name, value, options } of sets) {
      await (writeCtx as any).cookies.set(name, value, options);
    }
  });

  const setHeaders = (writeCtx.set.mock.calls[0]?.[1] ?? []) as Array<string>;
  const cookieHeader = headersToCookieHeader(setHeaders);

  const readCtx = buildCtx(cookieHeader);
  const readMiddleware = createHttpCookiesMiddleware(config);
  const readResults: Array<T | null> = [];

  await readMiddleware(readCtx as any, async () => {
    for (const { name, options } of reads) {
      readResults.push(await (readCtx as any).cookies.get(name, options));
    }
  });

  return {
    setHeaders,
    cookieHeader,
    reads: readResults,
    writeCtx,
    readCtx,
  };
};

const runSingleRoundTrip = async <T = unknown>(
  value: unknown,
  options: PylonSetCookie = {},
  config: PylonCookieConfig = {},
): Promise<RunRoundTripResult<T>> => {
  const name = "rt_cookie";
  const result = await runRoundTrip<T>(
    config,
    [{ name, value, options }],
    [{ name, options }],
  );
  return {
    setHeaders: result.setHeaders,
    cookieHeader: result.cookieHeader,
    read: result.reads[0] ?? null,
    writeCtx: result.writeCtx,
    readCtx: result.readCtx,
  };
};

describe("httpCookiesMiddleware round-trip", () => {
  let config: PylonCookieConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      domain: "http://lindorm.io",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    };

    signCookie.mockResolvedValue({ signature: "sig-x", kid: "kid-x" });
    verifyCookie.mockResolvedValue(undefined);
  });

  test("plain string under threshold round-trips", async () => {
    const value = "hello world";

    const { setHeaders, read } = await runSingleRoundTrip<string>(value, {}, config);

    expect(setHeaders).toHaveLength(1);
    expect(setHeaders[0]).toMatch(/^rt_cookie=/);
    expect(setHeaders[0]).not.toMatch(/^rt_cookie\.0=/);
    expect(read).toBe(value);
  });

  test("plain string over threshold round-trips byte-exact", async () => {
    const value = "x".repeat(10_000);

    const { setHeaders, read } = await runSingleRoundTrip<string>(value, {}, config);

    expect(setHeaders.length).toBeGreaterThan(1);
    expect(setHeaders[0]).toMatch(/^rt_cookie\.0=/);
    expect(setHeaders[1]).toMatch(/^rt_cookie\.1=/);
    expect(read).toBe(value);
  });

  test("JSON object over threshold round-trips", async () => {
    const value = {
      accessToken: "a".repeat(3000),
      idToken: "b".repeat(3000),
      refreshToken: "c".repeat(2000),
    };

    const { setHeaders, read } = await runSingleRoundTrip<typeof value>(
      value,
      { encoding: "base64url" },
      config,
    );

    expect(setHeaders.length).toBeGreaterThan(1);
    expect(setHeaders[0]).toMatch(/^rt_cookie\.0=/);
    expect(read).toEqual(value);
  });

  test("signed + over threshold round-trips and verifies once with the joined value", async () => {
    const value = "x".repeat(10_000);

    const { setHeaders, read } = await runSingleRoundTrip<string>(
      value,
      { signed: true },
      config,
    );

    const chunkHeaders = setHeaders.filter((h) => /^rt_cookie\.\d+=/.test(h));
    const sigHeaders = setHeaders.filter((h) => h.startsWith("rt_cookie.sig="));
    const kidHeaders = setHeaders.filter((h) => h.startsWith("rt_cookie.kid="));

    expect(chunkHeaders.length).toBeGreaterThan(1);
    expect(sigHeaders).toHaveLength(1);
    expect(kidHeaders).toHaveLength(1);

    expect(signCookie).toHaveBeenCalledTimes(1);
    const signedValue = signCookie.mock.calls[0][1] as string;

    const expectedEncoded = Buffer.from(value).toString("base64url");
    expect(signedValue).toBe(expectedEncoded);

    expect(verifyCookie).toHaveBeenCalledTimes(1);
    const verifyArgs = verifyCookie.mock.calls[0];
    const verifiedValue = verifyArgs[2] as string;
    const verifiedSignature = verifyArgs[3] as string;
    const verifiedKid = verifyArgs[4] as string;

    expect(verifiedValue).toBe(expectedEncoded);
    expect(verifiedValue.length).toBe(expectedEncoded.length);

    const firstChunkValue = /^rt_cookie\.0=([^;]*)/.exec(chunkHeaders[0])?.[1] ?? "";
    expect(verifiedValue).not.toBe(firstChunkValue);
    expect(verifiedValue.length).toBeGreaterThan(firstChunkValue.length);

    expect(verifiedSignature).toBe("sig-x");
    expect(verifiedKid).toBe("kid-x");

    expect(read).toBe(value);
  });

  test("encrypted + over threshold round-trips with byte-exact tokenised payload", async () => {
    const tokenised = `aes:${"y".repeat(8_000)}`;
    const plaintext = "secret";

    const writeCtx = buildCtx("");
    writeCtx.aegis.aes.encrypt = vi.fn().mockResolvedValue(tokenised);

    const writeMiddleware = createHttpCookiesMiddleware(config);
    await writeMiddleware(writeCtx as any, async () => {
      await (writeCtx as any).cookies.set("rt_cookie", plaintext, { encrypted: true });
    });

    const setHeaders = writeCtx.set.mock.calls[0][1] as Array<string>;

    expect(setHeaders.length).toBeGreaterThan(1);
    expect(setHeaders[0]).toMatch(/^rt_cookie\.0=/);

    const cookieHeader = headersToCookieHeader(setHeaders);

    const readCtx = buildCtx(cookieHeader);
    readCtx.aegis.aes.decrypt = vi.fn().mockResolvedValue(plaintext);

    const readMiddleware = createHttpCookiesMiddleware(config);
    let readValue: unknown = undefined;
    await readMiddleware(readCtx as any, async () => {
      readValue = await (readCtx as any).cookies.get("rt_cookie");
    });

    expect(readCtx.aegis.aes.decrypt).toHaveBeenCalledTimes(1);
    const decryptArg = (readCtx.aegis.aes.decrypt as unknown as Mock).mock
      .calls[0][0] as string;
    expect(decryptArg).toBe(tokenised);
    expect(decryptArg.length).toBe(tokenised.length);

    expect(readValue).toBe(plaintext);
  });

  test("chunked: false opt-out emits no .0/.1 chunks but still round-trips", async () => {
    const value = "x".repeat(10_000);

    const { setHeaders, read } = await runSingleRoundTrip<string>(
      value,
      { chunked: false },
      config,
    );

    expect(setHeaders).toHaveLength(1);
    expect(setHeaders[0]).toMatch(/^rt_cookie=/);
    expect(setHeaders[0]).not.toMatch(/^rt_cookie\.0=/);

    expect(read).toBe(value);
  });

  test("mixed names with similar prefixes do not collide", async () => {
    const oversized = "x".repeat(10_000);
    const small = "small_value";

    const result = await runRoundTrip<string>(
      config,
      [
        { name: "session", value: oversized },
        { name: "session_other", value: small },
      ],
      [{ name: "session" }, { name: "session_other" }],
    );

    const chunkHeaders = result.setHeaders.filter((h) => /^session\.\d+=/.test(h));
    const otherHeader = result.setHeaders.find((h) => h.startsWith("session_other="));
    const bareSessionHeader = result.setHeaders.find((h) => h.startsWith("session="));

    expect(chunkHeaders.length).toBeGreaterThan(1);
    expect(otherHeader).toBeDefined();
    expect(bareSessionHeader).toBeUndefined();

    expect(result.reads[0]).toBe(oversized);
    expect(result.reads[1]).toBe(small);
  });

  test("JSON with special characters round-trips when oversized + chunked", async () => {
    const longTail = "z".repeat(10_000);
    const value = {
      msg: 'hi; "world"; 日本語',
      tail: longTail,
    };

    const { setHeaders, read } = await runSingleRoundTrip<typeof value>(
      value,
      { encoding: "base64url" },
      config,
    );

    expect(setHeaders.length).toBeGreaterThan(1);
    expect(setHeaders[0]).toMatch(/^rt_cookie\.0=/);

    expect(read).toEqual(value);
    expect(read?.msg).toBe('hi; "world"; 日本語');
  });

  test("captured Set-Cookie headers match snapshot for a typical chunked write", async () => {
    const value = "x".repeat(5_000);

    const { setHeaders } = await runSingleRoundTrip<string>(value, {}, config);

    expect(setHeaders).toMatchSnapshot();
  });
});
