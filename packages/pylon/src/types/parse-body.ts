import { HttpMethod } from "@lindorm/enums";
import { Options as FormidableOptions } from "formidable";

export type ParseBodyConfig = {
  formidable: boolean;
  formidableOptions: FormidableOptions;
  limits: {
    json: string | number;
    form: string | number;
    text: string | number;
  };
  methods: Array<HttpMethod>;
  multipart: boolean;
};

export type ParseBodyOptions = {
  formidable?: boolean;
  formidableOptions?: FormidableOptions;
  limits?: {
    json?: string | number;
    form?: string | number;
    text?: string | number;
  };
  methods?: Array<HttpMethod>;
  multipart?: boolean;
};
