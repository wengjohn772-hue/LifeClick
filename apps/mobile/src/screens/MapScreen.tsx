import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import type * as Location from 'expo-location';
import { GradientScreen } from '../components/GradientScreen';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';

// Shown before a fix arrives so the map is never an empty grey box.
const FALLBACK_COORDINATE = { latitude: 40.7128, longitude: -74.006 };

export function MapScreen({
  location,
  message,
  backgroundActive,
}: {
  location: Location.LocationObject | null;
  message: string;
  backgroundActive: boolean;
}) {
  const { colors, shared, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const coordinate = location
    ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
    : FALLBACK_COORDINATE;

  const region: Region = { ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 };

  return (
    <GradientScreen>
      <Text style={shared.screenEyebrow}>Live location</Text>
      <Text style={shared.screenTitle}>Map</Text>
      <Text style={shared.screenSubtitle}>{message}</Text>

      <View style={styles.mapPreview}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          mapType="satellite"
          initialRegion={region}
          region={region}
          showsUserLocation={Boolean(location)}
          showsMyLocationButton={Boolean(location)}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
        >
          <Marker
            coordinate={coordinate}
            title={location ? 'Your location' : 'Preview location'}
            description={location ? 'Live location received' : 'Allow location to update this pin'}
          />
        </MapView>

        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>{location ? 'Your location received' : 'Satellite preview'}</Text>
          <Text style={styles.overlayText}>
            {`${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`}
          </Text>
          {location?.coords.accuracy ? (
            <Text style={styles.overlayText}>{`Accurate to about ${Math.round(location.coords.accuracy)} m`}</Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.statusCard, { backgroundColor: backgroundActive ? colors.safeSoft : colors.warnSoft }]}>
        <Text style={[styles.statusText, { color: backgroundActive ? colors.safe : colors.warn }]}>
          {backgroundActive
            ? 'Background monitoring is active — LifeClick keeps watching when the app is closed.'
            : 'Background monitoring is off. Allow location "Always" to stay protected when the app is closed.'}
        </Text>
      </View>
    </GradientScreen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    mapPreview: {
      height: 360,
      marginTop: 24,
      borderRadius: 26,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#355448',
      borderWidth: 1,
      borderColor: colors.line,
    },
    overlay: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.overlay,
    },
    overlayTitle: { color: '#ffffff', fontWeight: '800', fontSize: 17 },
    overlayText: { color: '#e6e0e9', fontSize: 13, marginTop: 5 },
    statusCard: { marginTop: 16, padding: 16, borderRadius: 18 },
    statusText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  });
