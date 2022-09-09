export interface Configuration {
  logger:   Logger;
  oauth:    Oauth;
  redis:    Redis;
  server:   Server;
  services: Services;
}

interface Logger {
  colours:   boolean;
  level:     string;
  readable:  boolean;
  timestamp: boolean;
}

interface Oauth {
  client_id:     string;
  client_secret: string;
}

interface Redis {
  host:       string;
  namespace:  string;
  password:   string;
  port:       number;
  username:   string;
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
  device_service: Service;
  oauth_service:  Service;
}

interface Service {
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

