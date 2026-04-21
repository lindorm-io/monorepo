import { DriverError } from "./DriverError.js";

/**
 * Thrown when a database operation is rejected because the circuit breaker is open.
 *
 * The underlying connection is considered unavailable. Operations will resume
 * automatically once the breaker transitions to half-open and a probe succeeds.
 */
export class CircuitOpenError extends DriverError {}
