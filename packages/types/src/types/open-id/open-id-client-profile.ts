export type OpenIdClientProfile =
  /**
   * A native application is a public client installed and
   * executed on the device used by the resource owner.
   * Protocol data and credentials are accessible to the
   * resource owner. It is assumed that any client authentication
   *  credentials included in the application can be extracted.
   * On the other hand, dynamically issued credentials such
   *  as access tokens or refresh tokens can receive an
   * acceptable level of protection. At a minimum, these
   * credentials are protected from hostile servers with
   * which the application may interact. On some platforms,
   * these credentials might be protected from other
   * applications residing on the same device.
   */
  | "native_application"

  /**
   * A user-agent-based application is a public client in which
   *  the client code is downloaded from a web server and
   * executes within a user-agent (e.g., web browser) on the
   * device used by the resource owner.  Protocol data and
   * credentials are easily accessible (and often visible) to
   * the resource owner.  Since such applications reside within
   * the user-agent, they can make seamless use of the user-agent
   * capabilities when requesting authorization.
   */
  | "user_agent_based_application"

  /**
   * A web application is a confidential client running on a
   * web server. Resource owners access the client via an HTML
   * user interface rendered in a user-agent on the device used
   * by the resource owner. The client credentials as well as
   * any access token issued to the client are stored on the
   * web server and are not exposed to or accessible by the
   * resource owner.
   */
  | "web_application";
