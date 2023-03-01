import { Expiry } from "../types";
import { getUnixTime } from "date-fns";
import { expiryDate } from "./expiry-date";

export const expiresAt = (expiry: Expiry): number => getUnixTime(expiryDate(expiry));
