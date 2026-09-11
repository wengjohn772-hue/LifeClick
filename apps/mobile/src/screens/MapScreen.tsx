import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import type * as Location from 'expo-location';
import { colors, shared } from '../theme';

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
  const coordinate = location
    ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
    : FALLBACK_COORDINATE;

  const region: Region = { ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 };

  return (
    <ScrollView contentContainerStyle={shared.screenContent}>
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

      <Text style={[styles.status, backgroundActive ? styles.statusOn : styles.statusOff]}>
        {backgroundActive
          ? 'Background monitoring is active — LifeClick keeps watching when the app is closed.'
          : 'Background monitoring is off. Allow location "Always" to stay protected when the app is closed.'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mapPreview: {
    height: 360,
    marginTop: 28,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#355448',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  overlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
  },
  overlayTitle: { color: colors.surface, fontWeight: '800', fontSize: 17 },
  overlayText: { color: '#e6e0e9', fontSize: 13, marginTop: 5 },
  status: { fontSize: 13, lineHeight: 19, marginTop: 18, fontWeight: '600' },
  statusOn: { color: colors.safe },
  statusOff: { color: colors.warn },
});
