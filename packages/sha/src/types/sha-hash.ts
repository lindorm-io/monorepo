import { ShaAlgorithm } from "@lindorm/types";
import { BinaryToTextEncoding } from "crypto";

export type CreateShaHashOptions = {
  algorithm?: ShaAlgorithm;
  data: string | Buffer;
  encoding?: BinaryToTextEncoding;
};

export type VerifyShaHashOptions = {
  algorithm?: ShaAlgorithm;
  data: string | Buffer;
  encoding?: BinaryToTextEncoding;
  hash: string;
};

export type ShaKitOptions = {
  algorithm?: ShaAlgorithm;
  encoding?: BinaryToTextEncoding;
};
