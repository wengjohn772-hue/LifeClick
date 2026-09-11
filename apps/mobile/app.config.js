// Layers environment-driven values over the static config in app.json.
//
// Everything here is optional so the project still builds during MVP, when the
// handoff allows Google Maps billing to stay suspended and before `eas init`
// has assigned a project ID.

const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
const easProjectId = process.env.EAS_PROJECT_ID;

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  // react-native-maps needs a key baked into the binary for Google Maps to
  // render. Android has no non-Google native provider, so without this the
  // satellite view is blank in a standalone build. Added only when a key
  // exists, so key-less MVP builds keep working.
  if (androidGoogleMapsApiKey || iosGoogleMapsApiKey) {
    plugins.push([
      'react-native-maps',
      {
        ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
        ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
      },
    ]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      // Consumed by getExpoPushTokenAsync(). EAS Build sets this automatically,
      // but the SDK 57 docs recommend setting it explicitly.
      eas: {
        ...config.extra?.eas,
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
      googleMapsConfigured: Boolean(androidGoogleMapsApiKey || iosGoogleMapsApiKey),
    },
  };
};
