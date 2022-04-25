export enum IdentityPermission {
  USER = "lindorm.io/any/identity/any:user",

  CLIENT_ADMIN = "lindorm.io/oauth-service/identity/client:admin",
  CLIENT_WRITE = "lindorm.io/oauth-service/identity/client:write",
  CLIENT_READ = "lindorm.io/oauth-service/identity/client:read",

  TENANT_ADMIN = "lindorm.io/oauth-service/identity/tenant:admin",
  TENANT_WRITE = "lindorm.io/oauth-service/identity/tenant:write",
  TENANT_READ = "lindorm.io/oauth-service/identity/tenant:read",
}
