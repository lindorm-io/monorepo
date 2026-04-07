export type ListenerEntry = {
  handler: (data: any) => void;
  wrapped: (...args: Array<any>) => void;
  once: boolean;
};
