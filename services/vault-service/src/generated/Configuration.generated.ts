export interface Configuration {
  logger:   Logger;
  mongo:    Mongo;
  oauth:    Oauth;
  redis:    Mongo;
  secrets:  Secrets;
  server:   Server;
  services: Services;
}

interface Logger {
  colours:   boolean;
  level:     string;
  readable:  boolean;
  timestamp: boolean;
}

interface Mongo {
  db_name:    string;
  host:       string;
  namespace:  string;
  password:   string;
  port:       number;
  username:   string;
}

interface Oauth {
  client_id:     string;
  client_secret: string;
}

interface Secrets {
  aes: string;
}

interface Server {
  domain:      string;
  environment: string;
  host:        string;
  issuer:      string;
  keys:        any[];
  port:        number;
  workers:     boolean;
}

interface Services {
  oauth_service: OauthService;
}

interface OauthService {
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

