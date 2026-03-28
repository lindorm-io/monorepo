import { IrisSerializationError } from "../../../errors/IrisSerializationError";
import { compress, decompress } from "./compress";

describe("compress / decompress", () => {
  const input = Buffer.from("hello world, this is a compression test payload");

  describe("gzip", () => {
    it("should round-trip correctly", async () => {
      const compressed = await compress(input, "gzip");
      expect(compressed).not.toEqual(input);
      expect(compressed.length).toBeGreaterThan(0);

      const decompressed = await decompress(compressed, "gzip");
      expect(decompressed).toEqual(input);
    });
  });

  describe("deflate", () => {
    it("should round-trip correctly", async () => {
      const compressed = await compress(input, "deflate");
      expect(compressed).not.toEqual(input);
      expect(compressed.length).toBeGreaterThan(0);

      const decompressed = await decompress(compressed, "deflate");
      expect(decompressed).toEqual(input);
    });
  });

  describe("brotli", () => {
    it("should round-trip correctly", async () => {
      const compressed = await compress(input, "brotli");
      expect(compressed).not.toEqual(input);
      expect(compressed.length).toBeGreaterThan(0);

      const decompressed = await decompress(compressed, "brotli");
      expect(decompressed).toEqual(input);
    });
  });

  describe("invalid algorithm", () => {
    it("should throw on compress", async () => {
      await expect(compress(input, "lz4" as any)).rejects.toThrow(IrisSerializationError);
    });

    it("should throw on decompress", async () => {
      await expect(decompress(input, "lz4" as any)).rejects.toThrow(
        IrisSerializationError,
      );
    });
  });
});
