import { expiresAt, Expiry } from "@lindorm/date";
import { ServerError } from "@lindorm/errors";
import { isDate, isString } from "@lindorm/is";
import {
  FIELD_CONTENT_REG_EXP,
  PRIORITY_REGEXP,
  RESTRICTED_NAME_CHARS_REGEXP,
  RESTRICTED_NAMES_REGEXP,
  RESTRICTED_VALUE_CHARS_REGEXP,
  SAME_SITE_REGEXP,
} from "../../constants/private";
import { CookiePriority, CookieSameSite, PylonCookieOptions } from "../../types";

export class PylonCookie {
  private readonly domain: string | null;
  private readonly expiry: Expiry | null;
  private readonly httpOnly: boolean;
  private readonly partitioned: boolean;
  private readonly path: string;
  private readonly priority: CookiePriority | null;
  private readonly sameSite: CookieSameSite | null;
  private readonly secure: boolean;
  private readonly value: string;

  public readonly name: string;

  public constructor(name: string, value: string | null, options: PylonCookieOptions) {
    PylonCookie.verifyDomain(options.domain);
    PylonCookie.verifyExpiry(options.expiry);
    PylonCookie.verifyName(name);
    PylonCookie.verifyPath(options.path);
    PylonCookie.verifyPriority(options.priority);
    PylonCookie.verifySameSite(options.sameSite);
    PylonCookie.verifyValue(value);

    this.domain = options.domain || null;
    this.expiry = options.expiry || null;
    this.httpOnly = options.httpOnly ?? false;
    this.name = name;
    this.partitioned = options.partitioned ?? false;
    this.path = options.path || "/";
    this.priority = options.priority || null;
    this.sameSite = options.sameSite || null;
    this.secure = options.secure ?? false;
    this.value = value || "";
  }

  // public

  public toString(): string {
    return `${this.name}=${this.value}`;
  }

  public toHeader(): string {
    let header = this.toString();

    const expires = this.expiry ? expiresAt(this.expiry) : null;

    if (this.domain) {
      header += `; domain=${this.domain}`;
    }
    if (this.path) {
      header += `; path=${this.path}`;
    }
    if (expires) {
      header += `; expires=${expires.toUTCString()}`;
    }
    if (this.priority) {
      header += `; priority=${this.priority}`;
    }
    if (this.sameSite) {
      header += `; samesite=${this.sameSite}`;
    }
    if (this.secure) {
      header += "; secure";
    }
    if (this.httpOnly) {
      header += "; httponly";
    }
    if (this.partitioned) {
      header += "; partitioned";
    }

    return header;
  }

  // private

  private static verifyDomain(domain?: string): void {
    if (!domain) return;
    if (!FIELD_CONTENT_REG_EXP.test(domain)) {
      throw new ServerError("Invalid cookie domain", {
        details: "Cookie domain must be a valid field content",
      });
    }
  }

  private static verifyExpiry(expiry?: Expiry): void {
    if (!expiry) return;
    if (!isDate(expiry) && !isString(expiry)) {
      throw new ServerError("Invalid cookie expiry", {
        details: "Cookie expiry must be a valid date or string",
      });
    }
  }

  private static verifyName(name: string): void {
    if (!FIELD_CONTENT_REG_EXP.test(name)) {
      throw new ServerError("Invalid cookie name", {
        details: "Cookie name must be a valid field content",
      });
    }
    if (RESTRICTED_NAME_CHARS_REGEXP.test(name)) {
      throw new ServerError("Invalid cookie name", {
        details: "Cookie name must not contain restricted characters",
        debug: { RESTRICTED_NAME_CHARS_REGEXP },
      });
    }
    if (RESTRICTED_NAMES_REGEXP.test(name)) {
      throw new ServerError("Invalid cookie name", {
        details: "Cookie name must not be a restricted name",
        debug: { RESTRICTED_NAMES_REGEXP },
      });
    }
  }

  private static verifyPath(path?: string): void {
    if (!path) return;
    if (!FIELD_CONTENT_REG_EXP.test(path)) {
      throw new ServerError("Invalid cookie path", {
        details: "Cookie path must be a valid field content",
      });
    }
  }

  private static verifyPriority(priority?: CookiePriority): void {
    if (!priority) return;
    if (!PRIORITY_REGEXP.test(priority)) {
      throw new ServerError("Invalid cookie priority", {
        details: "Cookie priority must be a valid priority",
        debug: { PRIORITY_REGEXP },
      });
    }
  }

  private static verifySameSite(sameSite?: CookieSameSite): void {
    if (!sameSite) return;
    if (!SAME_SITE_REGEXP.test(sameSite)) {
      throw new ServerError("Invalid cookie sameSite", {
        details: "Cookie sameSite must be a valid sameSite",
        debug: { SAME_SITE_REGEXP },
      });
    }
  }

  private static verifyValue(value: string | null): void {
    if (!value) return;
    if (!FIELD_CONTENT_REG_EXP.test(value)) {
      throw new ServerError("Invalid cookie value", {
        details: "Cookie value must be a valid field content",
      });
    }
    if (RESTRICTED_VALUE_CHARS_REGEXP.test(value)) {
      throw new ServerError("Invalid cookie value", {
        details: "Cookie value must not contain restricted characters",
        debug: { RESTRICTED_VALUE_CHARS_REGEXP },
      });
    }
  }
}
