export interface Configuration {
  oauth:     Oauth;
  redis:     Redis;
  server:    Server;
  services:  Services;
}

interface Oauth {
  client_id:      string;
  client_secret:  string;
  host:           string;
}

interface Redis {
  host:      string;
  password:  null | string;
  port:      number;
  username:  null | string;
}

interface Server {
  environment: string;
  host:        string;
  port:        number;
}

interface Services {
  communication_service: string;
}

