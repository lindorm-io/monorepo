import { OpenIdAddress } from "../open-id";

type CustomAddress = {
  careOf: string | null;
};

export type LindormAddress = OpenIdAddress & CustomAddress;
