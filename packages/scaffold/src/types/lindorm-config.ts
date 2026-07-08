export type LindormConfig = {
  proteus?: { sourceDir?: string; entitiesDir?: string };
  iris?: { sourceDir?: string; messagesDir?: string };
  pylon?: {
    routesDir?: string;
    handlersDir?: string;
    listenersDir?: string;
    workersDir?: string;
    featureDir?: string;
  };
};
