import { getTyping as _getTyping } from "./get-typing";
import { readYamlFiles as _readYamlFiles } from "./read-yaml-files";
import { writeLinesToFile as _writeLinesToFile } from "./write-lines-to-file";
import { yamlTyping } from "./yaml-typing";

jest.mock("./get-typing");
jest.mock("./read-yaml-files");
jest.mock("./write-lines-to-file");

const getTyping = _getTyping as jest.Mock;
const readYamlFiles = _readYamlFiles as jest.Mock;
const writeLinesToFile = _writeLinesToFile as jest.Mock;

describe("yamlTyping", () => {
  beforeEach(() => {
    getTyping.mockImplementation(async () => ({ lines: ["lines"] }));
    readYamlFiles.mockImplementation(() => ["samples"]);
    writeLinesToFile.mockImplementation(async () => {});
  });

  test("should resolve", async () => {
    const options = {
      extensions: [".ext"],
      read: "read",
      requireAll: false,
      root: "root",
      write: "write",
    };

    await expect(
      yamlTyping("fileName", {
        extensions: [".ext"],
        read: "read",
        requireAll: false,
        root: "root",
        write: "write",
      }),
    ).resolves.toBeUndefined();

    expect(readYamlFiles).toHaveBeenCalledWith("read", options);
    expect(getTyping).toHaveBeenCalledWith("fileName", ["samples"]);
    expect(writeLinesToFile).toHaveBeenCalledWith("fileName", ["lines"], options);
  });
});
