import { confirm, input, select } from "@inquirer/prompts";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { KryptosKit } from "./classes/index.js";
import { generate } from "./cli.js";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}));

const mockSelect = select as unknown as Mock;
const mockInput = input as unknown as Mock;
const mockConfirm = confirm as unknown as Mock;

// Runs `generate`, captures its console output, and returns the exported
// `kryptos:…` env string so we can re-import + assert on the real key.
const runGenerate = async (
  options: Parameters<typeof generate>[0] = {},
): Promise<string> => {
  const logs: Array<string> = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: Array<unknown>) => {
    logs.push(args.map(String).join(" "));
  });

  await generate(options);

  spy.mockRestore();

  const match = logs.join("\n").match(/kryptos:\S+/);
  if (!match) throw new Error("no env string in CLI output");
  return match[0];
};

describe("kryptos generate CLI", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockInput.mockReset();
    mockConfirm.mockReset();
  });

  test("generates a plain key when no certificate is requested", async () => {
    mockSelect
      .mockResolvedValueOnce("EC") // type
      .mockResolvedValueOnce("sig") // use
      .mockResolvedValueOnce("ES256"); // algorithm
    mockInput.mockResolvedValueOnce(""); // purpose
    mockConfirm.mockResolvedValueOnce(false); // no certificate

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.type).toBe("EC");
    expect(key.hasCertificate).toBe(false);
  });

  test("stamps a root-ca certificate when requested", async () => {
    mockSelect
      .mockResolvedValueOnce("EC") // type
      .mockResolvedValueOnce("sig") // use
      .mockResolvedValueOnce("ES384") // algorithm
      .mockResolvedValueOnce("root-ca"); // certificate mode
    mockInput
      .mockResolvedValueOnce("") // purpose
      .mockResolvedValueOnce("Lindorm Root CA") // subject
      .mockResolvedValueOnce("Lindorm") // organization
      .mockResolvedValueOnce("") // SANs
      .mockResolvedValueOnce("1"); // path length constraint
    mockConfirm.mockResolvedValueOnce(true); // wants a certificate

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.hasCertificate).toBe(true);
    expect(key.certificateThumbprint).toBeTruthy();
    expect(key.certificateChain.length).toBeGreaterThan(0);
  });

  test("never offers a certificate for symmetric (oct) keys", async () => {
    mockSelect
      .mockResolvedValueOnce("oct") // type
      .mockResolvedValueOnce("sig") // use
      .mockResolvedValueOnce("HS256"); // algorithm
    mockInput.mockResolvedValueOnce(""); // purpose

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.type).toBe("oct");
    expect(key.hasCertificate).toBe(false);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("runs fully from flags with no prompts (scriptable root-ca)", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES384",
        certificate: "root-ca",
        subject: "Lindorm Root CA",
        organization: "Lindorm",
        pathLength: "1",
      }),
    );

    expect(key.hasCertificate).toBe(true);
    expect(key.certificateChain.length).toBeGreaterThan(0);
    // Zero prompts — a scripted run must not block on stdin.
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInput).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("accepts the parent CA via --ca for a ca-signed cert (no prompts)", async () => {
    const rootCaEnv = KryptosKit.env.export(
      KryptosKit.generate.auto({
        algorithm: "ES384",
        certificate: {
          mode: "root-ca",
          subject: "Lindorm Root CA",
          organization: "Lindorm",
        },
      }),
    );

    const leaf = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        certificate: "ca-signed",
        ca: rootCaEnv,
        subject: "tyr.lindorm.io",
      }),
    );

    expect(leaf.hasCertificate).toBe(true);
    // Chain carries the signing CA cert as well as the leaf.
    expect(leaf.certificateChain.length).toBeGreaterThanOrEqual(2);
    expect(mockInput).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
