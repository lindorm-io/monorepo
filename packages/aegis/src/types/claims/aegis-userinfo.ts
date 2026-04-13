import { AegisProfile } from "./aegis-profile";

export type AegisUserinfo = AegisProfile & {
  subject: string;
};
