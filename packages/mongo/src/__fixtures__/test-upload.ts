import { MongoFileBase } from "../classes";

export type TestUploadOptions = {
  busboy?: boolean;
  encoding?: string;
  formidable?: boolean;
  hash?: string;
  hashAlgorithm?: string;
  size?: number;
};

export class TestUpload extends MongoFileBase {
  public readonly busboy: boolean;
  public readonly encoding: string | undefined;
  public readonly formidable: boolean;
  public readonly hash: string | undefined;
  public readonly hashAlgorithm: string | undefined;
  public readonly size: number | undefined;

  public constructor(options: TestUploadOptions) {
    super();

    this.busboy = options.busboy ?? false;
    this.encoding = options.encoding;
    this.formidable = options.formidable ?? false;
    this.hash = options.hash;
    this.hashAlgorithm = options.hashAlgorithm;
    this.size = options.size;
  }
}
