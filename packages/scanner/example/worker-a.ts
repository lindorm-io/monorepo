export class WorkerBrand {
  constructor(readonly alias: string) {}
}

export const brand = new WorkerBrand("worker-a");

export const CALLBACK = async (): Promise<string> => "called from worker-a";

export const INTERVAL = 1000;
