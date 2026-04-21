import type { HttpMethod } from "@lindorm/types";
import type { DeepPartial } from "@lindorm/types";
import type { Options as FormidableOptions } from "formidable";

type Byte = "B" | "Kb" | "Mb" | "Gb" | "Tb" | "Pb";
type ByteReverse = "b" | "kB" | "mB" | "gB" | "tB" | "pB";
type ByteAnyCase = Byte | ByteReverse | Uppercase<Byte> | Lowercase<Byte>;

export type ParseLimit = `${number}${ByteAnyCase}` | `${number} ${ByteAnyCase}`;

export type ParseBodyConfig = {
  formidable: boolean;
  formidableOptions: FormidableOptions;
  limits: {
    json: ParseLimit | number;
    form: ParseLimit | number;
    text: ParseLimit | number;
  };
  methods: Array<HttpMethod>;
  multipart: boolean;
};

export type ParseBodyOptions = DeepPartial<ParseBodyConfig>;
