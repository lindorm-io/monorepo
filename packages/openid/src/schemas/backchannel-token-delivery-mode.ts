import { z } from "zod";
import { BackchannelTokenDeliveryMode } from "../enums/BackchannelTokenDeliveryMode.js";

/**
 * CLOSED validator for the OpenID Connect CIBA Core 1.0 §4 token delivery
 * modes, built from the `BackchannelTokenDeliveryMode` runtime object.
 */
export const backchannelTokenDeliveryModeSchema = z.enum(BackchannelTokenDeliveryMode);
