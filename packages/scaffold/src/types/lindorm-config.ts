export type LindormConfig = {
  db?: { sourceDir?: string; entitiesDir?: string };
  kv?: { sourceDir?: string; entitiesDir?: string };
  bus?: { sourceDir?: string; messagesDir?: string };
  pylon?: {
    routesDir?: string;
    handlersDir?: string;
    listenersDir?: string;
    workersDir?: string;
    featureDir?: string;
  };
};
