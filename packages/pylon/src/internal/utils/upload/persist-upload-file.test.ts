import { createHash } from "node:crypto";
import { access, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "path";
import { commitTempFile, copyToTemp, discardTempFile } from "./persist-upload-file.js";
import { afterEach, describe, expect, test } from "vitest";

const dirs: Array<string> = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "lindorm-persist-"));
  dirs.push(dir);
  return dir;
};

const makeSource = async (dir: string, content: string): Promise<string> => {
  const path = join(dir, "source.bin");
  await writeFile(path, content);
  return path;
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

afterEach(() => {
  dirs.length = 0;
});

describe("copyToTemp", () => {
  test("copies content into a dot-prefixed temp inside the target dir", async () => {
    const dir = await makeDir();
    const source = await makeSource(dir, "hello world");

    const { tempPath, hash } = await copyToTemp(source, dir, false);

    // Dot-prefixed so a co-located STATIC mount's dotfile rule hides it.
    expect(basename(tempPath).startsWith(".upload-")).toBe(true);
    expect(await readFile(tempPath, "utf8")).toBe("hello world");
    expect(hash).toBeNull();
  });

  test("computes the base64url sha-256 of the content in the same pass", async () => {
    const dir = await makeDir();
    const content = "content to be hashed";
    const source = await makeSource(dir, content);

    const { hash } = await copyToTemp(source, dir, true);

    // Independently computed digest — the streamed hash must equal it exactly.
    const expected = createHash("sha256").update(content).digest("base64url");
    expect(hash).toBe(expected);
  });

  test("leaves no temp behind when the source cannot be read", async () => {
    const dir = await makeDir();

    await expect(copyToTemp(join(dir, "missing.bin"), dir, false)).rejects.toThrow();

    const entries = await readdir(dir);
    expect(entries.filter((e) => e.startsWith(".upload-"))).toEqual([]);
  });
});

describe("commitTempFile", () => {
  test("atomically commits the temp into the final name", async () => {
    const dir = await makeDir();
    const source = await makeSource(dir, "final content");
    const { tempPath } = await copyToTemp(source, dir, false);
    const finalPath = join(dir, "final.txt");

    await commitTempFile(tempPath, finalPath, false);

    expect(await exists(tempPath)).toBe(false);
    expect(await readFile(finalPath, "utf8")).toBe("final content");
  });

  test("fails EEXIST instead of replacing when overwrite is off", async () => {
    const dir = await makeDir();
    await writeFile(join(dir, "final.txt"), "original");
    const source = await makeSource(dir, "intruder");
    const { tempPath } = await copyToTemp(source, dir, false);

    await expect(
      commitTempFile(tempPath, join(dir, "final.txt"), false),
    ).rejects.toMatchObject({ code: "EEXIST" });

    // The existing file is untouched; the temp is the caller's to clean up.
    expect(await readFile(join(dir, "final.txt"), "utf8")).toBe("original");
    expect(await exists(tempPath)).toBe(true);
  });

  test("replaces an existing target when overwrite is on", async () => {
    const dir = await makeDir();
    await writeFile(join(dir, "final.txt"), "original");
    const source = await makeSource(dir, "replacement");
    const { tempPath } = await copyToTemp(source, dir, false);

    await commitTempFile(tempPath, join(dir, "final.txt"), true);

    expect(await exists(tempPath)).toBe(false);
    expect(await readFile(join(dir, "final.txt"), "utf8")).toBe("replacement");
  });
});

describe("discardTempFile", () => {
  test("unlinks an existing temp", async () => {
    const dir = await makeDir();
    const source = await makeSource(dir, "x");
    const { tempPath } = await copyToTemp(source, dir, false);

    await discardTempFile(tempPath);

    expect(await exists(tempPath)).toBe(false);
  });

  test("is a no-op when the temp does not exist (best-effort)", async () => {
    const dir = await makeDir();
    await expect(discardTempFile(join(dir, ".upload-gone"))).resolves.toBeUndefined();
  });
});
