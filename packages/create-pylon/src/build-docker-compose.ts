import type { Answers, IrisDriver, ProteusDriver } from "./types.js";
import { selectedDrivers } from "./types.js";

// A `volume` names a top-level named volume this service persists into. Named
// (not anonymous) so `composed --keep-volumes` on `npm run dev` actually keeps
// the data across restarts — anonymous volumes are orphaned on teardown and a
// fresh one is mounted on the next `up`, defeating the point. Compose prefixes
// the name with the project (`tyr_postgres_data`), so the `test` project's
// `<name>-test` namespace stays isolated and its clean-slate teardown never
// touches the dev volumes.
//
// Every stateful service ships a `healthcheck`. `composed` runs `up -d --wait`,
// and `--wait` only blocks for real readiness when a healthcheck exists —
// otherwise it returns as soon as the container is "running", so on a service's
// first boot (e.g. postgres running `initdb`, which briefly listens only on a
// unix socket) the host app connects before TCP is accepting → ECONNREFUSED.
type ServiceBlock = { name: string; lines: Array<string>; volume?: string };

const postgresBlock = (): ServiceBlock => ({
  name: "postgres",
  volume: "postgres_data",
  lines: [
    `  postgres:`,
    `    image: postgres:18`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      POSTGRES_DB: app`,
    `      POSTGRES_USER: postgres`,
    `      POSTGRES_PASSWORD: postgres`,
    `    ports:`,
    `      - "5432:5432"`,
    `    volumes:`,
    // postgres:18+ stores data in a major-version subdir, so the mount goes on
    // the PARENT (/var/lib/postgresql), not /…/data — mounting /…/data makes
    // PG18 refuse to start ("data in unused mount/volume"). (PG≤17 used /…/data.)
    `      - postgres_data:/var/lib/postgresql`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]`,
    `      interval: 2s`,
    `      timeout: 3s`,
    `      retries: 15`,
    `      start_period: 10s`,
  ],
});

const mysqlBlock = (): ServiceBlock => ({
  name: "mysql",
  volume: "mysql_data",
  lines: [
    `  mysql:`,
    `    image: mysql:9`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      MYSQL_DATABASE: app`,
    `      MYSQL_ROOT_PASSWORD: root`,
    `    ports:`,
    `      - "3306:3306"`,
    `    volumes:`,
    `      - mysql_data:/var/lib/mysql`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -proot --silent"]`,
    `      interval: 2s`,
    `      timeout: 3s`,
    `      retries: 15`,
    `      start_period: 15s`,
  ],
});

const mongoBlock = (): ServiceBlock => ({
  name: "mongo",
  volume: "mongo_data",
  lines: [
    `  mongo:`,
    `    image: mongo:8`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "27017:27017"`,
    `    volumes:`,
    `      - mongo_data:/data/db`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "mongosh --quiet --eval 'db.adminCommand({ ping: 1 })'"]`,
    `      interval: 2s`,
    `      timeout: 3s`,
    `      retries: 15`,
    `      start_period: 10s`,
  ],
});

const redisBlock = (): ServiceBlock => ({
  name: "redis",
  volume: "redis_data",
  lines: [
    `  redis:`,
    `    image: redis:8`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "6379:6379"`,
    `    volumes:`,
    `      - redis_data:/data`,
    `    healthcheck:`,
    `      test: ["CMD", "redis-cli", "ping"]`,
    `      interval: 2s`,
    `      timeout: 3s`,
    `      retries: 15`,
  ],
});

// No healthcheck: the nats:2 image is minimal (no shell / wget to probe with),
// and the server accepts connections almost immediately, so `up --wait` on
// "running" is sufficient here.
const natsBlock = (): ServiceBlock => ({
  name: "nats",
  lines: [
    `  nats:`,
    `    image: nats:2`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "4222:4222"`,
  ],
});

const rabbitBlock = (): ServiceBlock => ({
  name: "rabbit",
  volume: "rabbit_data",
  lines: [
    `  rabbitmq:`,
    `    image: rabbitmq:4-management`,
    `    restart: unless-stopped`,
    `    ports:`,
    `      - "5672:5672"`,
    `      - "15672:15672"`,
    `    volumes:`,
    `      - rabbit_data:/var/lib/rabbitmq`,
    `    healthcheck:`,
    `      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]`,
    `      interval: 5s`,
    `      timeout: 5s`,
    `      retries: 15`,
    `      start_period: 20s`,
  ],
});

const zookeeperBlock = (): ServiceBlock => ({
  name: "zookeeper",
  volume: "zookeeper_data",
  lines: [
    `  zookeeper:`,
    `    image: confluentinc/cp-zookeeper:latest`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      ZOOKEEPER_CLIENT_PORT: 2181`,
    `      ZOOKEEPER_TICK_TIME: 2000`,
    `    ports:`,
    `      - "2181:2181"`,
    `    volumes:`,
    `      - zookeeper_data:/var/lib/zookeeper/data`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "nc -z localhost 2181"]`,
    `      interval: 5s`,
    `      timeout: 5s`,
    `      retries: 15`,
    `      start_period: 10s`,
  ],
});

const kafkaBlock = (): ServiceBlock => ({
  name: "kafka",
  volume: "kafka_data",
  lines: [
    `  kafka:`,
    `    image: confluentinc/cp-kafka:latest`,
    `    restart: unless-stopped`,
    `    depends_on:`,
    `      - zookeeper`,
    `    environment:`,
    `      KAFKA_BROKER_ID: 1`,
    `      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181`,
    `      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092`,
    `      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1`,
    `    ports:`,
    `      - "9092:9092"`,
    `    volumes:`,
    `      - kafka_data:/var/lib/kafka/data`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "kafka-topics --bootstrap-server localhost:9092 --list"]`,
    `      interval: 5s`,
    `      timeout: 10s`,
    `      retries: 20`,
    `      start_period: 30s`,
  ],
});

const proteusBlocks = (driver: ProteusDriver): Array<ServiceBlock> => {
  switch (driver) {
    case "postgres":
      return [postgresBlock()];
    case "mysql":
      return [mysqlBlock()];
    case "mongo":
      return [mongoBlock()];
    case "redis":
      return [redisBlock()];
    case "memory":
    case "sqlite":
    default:
      return [];
  }
};

const irisBlocks = (driver: IrisDriver): Array<ServiceBlock> => {
  switch (driver) {
    case "kafka":
      return [zookeeperBlock(), kafkaBlock()];
    case "nats":
      return [natsBlock()];
    case "rabbit":
      return [rabbitBlock()];
    case "redis":
      return [redisBlock()];
    case "none":
    default:
      return [];
  }
};

const dedupeByName = (blocks: Array<ServiceBlock>): Array<ServiceBlock> => {
  const seen = new Set<string>();
  const out: Array<ServiceBlock> = [];
  for (const block of blocks) {
    if (seen.has(block.name)) continue;
    seen.add(block.name);
    out.push(block);
  }
  return out;
};

export const buildDockerCompose = (answers: Answers): string | null => {
  const proteus = selectedDrivers(answers).flatMap((d) => proteusBlocks(d));
  const blocks = dedupeByName([...proteus, ...irisBlocks(answers.bus)]);

  if (blocks.length === 0) return null;

  const lines: Array<string> = [`services:`];
  for (const block of blocks) {
    lines.push(...block.lines);
  }

  // Declare the named volumes the stateful services persist into. Without this
  // top-level block, `postgres_data:` mounts would be anonymous and `-k` could
  // not keep them.
  const volumes = blocks.map((b) => b.volume).filter((v): v is string => Boolean(v));
  if (volumes.length > 0) {
    lines.push(``, `volumes:`);
    for (const volume of volumes) {
      lines.push(`  ${volume}:`);
    }
  }

  lines.push(``);

  return lines.join("\n");
};
