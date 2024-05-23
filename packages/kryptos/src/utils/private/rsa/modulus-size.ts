import { KryptosError } from "../../../errors";
import { RsaDer, RsaModulus } from "../../../types";

type Options = Omit<RsaDer, "algorithm" | "type" | "use">;

const SIZES = [
  {
    private: { min: 606, max: 611 },
    public: { min: 140, max: 140 },
    modulus: 1024,
  },
  {
    private: { min: 1188, max: 1193 },
    public: { min: 270, max: 270 },
    modulus: 2048,
  },
  {
    private: { min: 1765, max: 1769 },
    public: { min: 398, max: 398 },
    modulus: 3072,
  },
  {
    private: { min: 2345, max: 2350 },
    public: { min: 526, max: 526 },
    modulus: 4096,
  },
] as const;

export const modulusSize = (options: Options): RsaModulus => {
  if (!options.privateKey && !options.publicKey) {
    throw new KryptosError("Missing RSA key");
  }

  const privateLength = options.privateKey?.length || 0;
  const publicLength = options.publicKey?.length || 0;

  const size = SIZES.find(
    (size) =>
      size.private.min <= privateLength &&
      size.private.max >= privateLength &&
      size.public.min <= publicLength &&
      size.public.max >= publicLength,
  );

  if (!size) {
    throw new KryptosError("Unexpected RSA key size");
  }

  return size.modulus;
};
