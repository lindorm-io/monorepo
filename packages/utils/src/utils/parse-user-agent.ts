import type { DeviceType, UserAgentInfo } from "@lindorm/types";

// Ordered browser matchers — check the most specific first, since Edge, Opera,
// and Samsung Internet all embed the "Chrome" token, and Chrome-family browsers
// embed "Safari". `test` decides the name; `version` extracts the MAJOR version.
const BROWSERS: ReadonlyArray<{ test: RegExp; name: string; version: RegExp }> = [
  { test: /Electron/i, name: "Electron", version: /Electron\/(\d+)/i },
  { test: /Edg(?:e|A|iOS)?\//i, name: "Edge", version: /Edg(?:e|A|iOS)?\/(\d+)/i },
  { test: /OPR\/|Opera/i, name: "Opera", version: /(?:OPR|Version)\/(\d+)/i },
  {
    test: /SamsungBrowser/i,
    name: "Samsung Internet",
    version: /SamsungBrowser\/(\d+)/i,
  },
  { test: /Chrome\/|CriOS/i, name: "Chrome", version: /(?:Chrome|CriOS)\/(\d+)/i },
  { test: /Firefox\/|FxiOS/i, name: "Firefox", version: /(?:Firefox|FxiOS)\/(\d+)/i },
  { test: /Version\/.*Safari|Safari/i, name: "Safari", version: /Version\/(\d+)/i },
];

// Windows NT build number -> marketing version. Windows 11 also reports "10.0".
const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.1": "XP",
};

const detectBrowser = (ua: string): UserAgentInfo["browser"] => {
  for (const { test, name, version } of BROWSERS) {
    if (test.test(ua)) {
      const match = ua.match(version);
      return { name, version: match ? match[1] : null };
    }
  }
  return null;
};

const detectOs = (ua: string): UserAgentInfo["os"] => {
  const windows = ua.match(/Windows NT (\d+\.\d+)/i);
  if (windows) {
    return { name: "Windows", version: WINDOWS_VERSIONS[windows[1]] ?? windows[1] };
  }

  // iOS must be checked before macOS: iOS UAs contain "like Mac OS X".
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const version = ua.match(/OS (\d+[._]\d+(?:[._]\d+)?)/i);
    return { name: "iOS", version: version ? version[1].replace(/_/g, ".") : null };
  }

  const android = ua.match(/Android (\d+(?:\.\d+)?)/i);
  if (android) {
    return { name: "Android", version: android[1] };
  }

  const macos = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/i);
  if (macos) {
    return { name: "macOS", version: macos[1].replace(/_/g, ".") };
  }
  if (/Macintosh/i.test(ua)) {
    return { name: "macOS", version: null };
  }

  if (/CrOS/i.test(ua)) {
    return { name: "ChromeOS", version: null };
  }

  if (/Linux|X11/i.test(ua)) {
    return { name: "Linux", version: null };
  }

  return null;
};

const detectDeviceType = (ua: string): DeviceType => {
  if (/bot|crawler|spider|slurp/i.test(ua)) return "bot";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobile|iPhone/i.test(ua)) return "mobile";
  // Android without a "Mobile" token is conventionally a tablet.
  if (/Android/i.test(ua)) return "tablet";
  // Only claim "desktop" when a desktop OS token is present; bare garbage stays unknown.
  if (/Windows|Macintosh|Mac OS X|X11|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
};

/**
 * In-house, dependency-free User-Agent parser tuned for session-distinguishing
 * accuracy (browser/os name + MAJOR version), not analytics-grade precision.
 * Unknown or empty input degrades gracefully to null sub-fields.
 */
export const parseUserAgent = (raw: string | null): UserAgentInfo => {
  if (!raw || !raw.trim()) {
    return { raw: raw ?? null, browser: null, os: null, deviceType: "unknown" };
  }

  return {
    raw,
    browser: detectBrowser(raw),
    os: detectOs(raw),
    deviceType: detectDeviceType(raw),
  };
};
