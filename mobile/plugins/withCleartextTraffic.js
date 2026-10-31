const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to manage Android Cleartext Traffic (HTTP).
 *
 * Rules:
 * - Preview / Development APK: Enabled (android:usesCleartextTraffic="true") to allow
 *   direct HTTP communication with local LAN / staging backend (e.g. http://10.107.161.8:8000).
 * - Production: Strictly disabled (attribute removed) to enforce HTTPS for production security.
 */
function withCleartextTraffic(config, options = {}) {
  const buildProfile = (process.env.EAS_BUILD_PROFILE || "").toLowerCase();
  const enableFlag = process.env.ENABLE_CLEARTEXT_TRAFFIC;
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();

  // Determine if this is a production environment
  const isProduction =
    buildProfile === "production" ||
    options.enable === false ||
    enableFlag === "false" ||
    (nodeEnv === "production" && buildProfile !== "preview" && enableFlag !== "true");

  // Determine if this is preview / development
  const isPreviewOrDev =
    buildProfile === "preview" ||
    buildProfile === "development" ||
    enableFlag === "true" ||
    options.enable === true;

  const shouldAllowCleartext = isPreviewOrDev && !isProduction;

  return withAndroidManifest(config, (modConfig) => {
    const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);

    if (shouldAllowCleartext) {
      mainApp.$["android:usesCleartextTraffic"] = "true";
    } else {
      delete mainApp.$["android:usesCleartextTraffic"];
    }

    return modConfig;
  });
}

module.exports = withCleartextTraffic;

