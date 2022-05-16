export interface Configuration {
  oauth:    Oauth;
  redis:    Redis;
  server:   Server;
  services: Services;
}

interface Oauth {
  client_id:     string;
  client_secret: string;
}

interface Redis {
  host:      string;
  password:  string;
  port:      number;
  username:  string;
}

interface Server {
  domain:      string;
  environment: string;
  host:        string;
  issuer:      string;
  port:        number;
}

interface Services {
  device_service: Service;
  oauth_service:  Service;
}

interface Service {
  host:    string;
  issuer:  string;
  port:    number;
}

