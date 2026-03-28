export type CircuitBreakerState = "closed" | "open" | "half-open";

export type ErrorClassification = "transient" | "permanent" | "ignorable";

export type ErrorClassifier = (error: Error) => ErrorClassification;

export type StateChangeEvent = {
  name: string;
  from: CircuitBreakerState;
  to: CircuitBreakerState;
  failures: number;
  timestamp: number;
};

export type StateChangeCallback = (event: StateChangeEvent) => void;

export type CircuitBreakerOptions = {
  name: string;
  classifier?: ErrorClassifier;
  threshold?: number;
  window?: number;
  halfOpenDelay?: number;
  halfOpenBackoff?: number;
  halfOpenMaxDelay?: number;
  onStateChange?: StateChangeCallback;
};
