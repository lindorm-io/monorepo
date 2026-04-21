import type { AegisProfile } from "./aegis-profile.js";

export type AegisUserinfo = AegisProfile & {
  subject: string;
};
