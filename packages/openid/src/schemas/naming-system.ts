import { z } from "zod";
import { NamingSystem } from "../enums/NamingSystem.js";

/**
 * CLOSED validator for the LINDORM EXTENSION `namingSystem` claim values,
 * built from the `NamingSystem` runtime object. No RFC defines these.
 */
export const namingSystemSchema = z.enum(NamingSystem);
