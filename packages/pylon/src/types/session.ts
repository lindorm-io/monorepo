import { SetCookieOptions } from "./cookies";

export type PylonSession = {
  id: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
};

export type PylonSessionConfig = Omit<SetCookieOptions, "overwrite" | "priority"> & {
  name?: string;
};
