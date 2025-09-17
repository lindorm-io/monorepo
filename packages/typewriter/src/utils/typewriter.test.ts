import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { typewriter } from "./typewriter";

describe("typewriter", () => {
  test("should generate types from JSON input", async () => {
    await expect(
      typewriter({
        input: [join(__dirname, "..", "__fixtures__", "test.json")],
        writeToDirectory: tmpdir(),
        typeName: "TestTypeJson",
      }),
    ).resolves.toMatchSnapshot();

    expect(
      readFileSync(join(tmpdir(), "TestTypeJson.typewriter.ts"), "utf-8"),
    ).toMatchSnapshot();
  });

  test("should generate types from YAML input", async () => {
    await expect(
      typewriter({
        input: [join(__dirname, "..", "__fixtures__", "directory")],
        writeToDirectory: tmpdir(),
        typeName: "TestTypeYaml",
      }),
    ).resolves.toMatchSnapshot();

    expect(
      readFileSync(join(tmpdir(), "TestTypeYaml.typewriter.ts"), "utf-8"),
    ).toMatchSnapshot();
  });
});
