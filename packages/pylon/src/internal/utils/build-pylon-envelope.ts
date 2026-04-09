type PylonEnvelopeOptions = {
  correlationId: string;
  payload: unknown;
};

type PylonEnvelope = {
  __pylon: true;
  header: { correlationId: string };
  payload: unknown;
};

export const buildPylonEnvelope = (options: PylonEnvelopeOptions): PylonEnvelope => ({
  __pylon: true,
  header: { correlationId: options.correlationId },
  payload: options.payload,
});
