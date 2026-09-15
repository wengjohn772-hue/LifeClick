import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import type { FafFix } from '../types';

/** Great-circle distance in metres. */
export function distanceMetres(a: FafFix, b: FafFix) {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(metres: number) {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/**
 * Frames both people with room to spare, so neither marker sits on the edge.
 */
function regionFor(a: FafFix, b: FafFix): Region {
  const latitude = (a.latitude + b.latitude) / 2;
  const longitude = (a.longitude + b.longitude) / 2;
  const latitudeDelta = Math.max(Math.abs(a.latitude - b.latitude) * 2.2, 0.01);
  const longitudeDelta = Math.max(Math.abs(a.longitude - b.longitude) * 2.2, 0.01);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

export function FafMap({
  me,
  them,
  myName,
  theirName,
}: {
  me: FafFix | null;
  them: FafFix | null;
  myName: string;
  theirName: string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!me || !them) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Waiting for a position</Text>
        <Text style={styles.placeholderBody}>
          {!me && !them
            ? 'Neither device has reported a location yet. Open the Map tab to start sharing yours.'
            : !me
              ? 'Your location has not been reported yet. Open the Map tab so your position is shared.'
              : `${theirName} has not shared a position yet. The trail appears once their device reports one.`}
        </Text>
      </View>
    );
  }

  const metres = distanceMetres(me, them);

  return (
    <View style={styles.wrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={regionFor(me, them)}
        region={regionFor(me, them)}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        {/* The connecting trail. Geodesic so it follows the earth's curve
            rather than cutting a straight line across the projection. */}
        <Polyline
          coordinates={[
            { latitude: me.latitude, longitude: me.longitude },
            { latitude: them.latitude, longitude: them.longitude },
          ]}
          strokeColor={colors.brand}
          strokeWidth={4}
          lineDashPattern={[10, 6]}
          geodesic
        />

        <Marker
          coordinate={{ latitude: me.latitude, longitude: me.longitude }}
          title={myName}
          description="You"
          pinColor="#6d28d9"
        />
        <Marker
          coordinate={{ latitude: them.latitude, longitude: them.longitude }}
          title={theirName}
          description={`${formatDistance(metres)} away`}
          pinColor="#16a34a"
        />
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>{`${formatDistance(metres)} apart`}</Text>
        <Text style={styles.overlayBody} numberOfLines={1}>
          {`${myName} ↔ ${theirName}`}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      height: 320,
      marginTop: 14,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.brandSoft,
    },
    overlay: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.overlay,
    },
    overlayTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
    overlayBody: { color: '#e6e0e9', fontSize: 12, marginTop: 3 },
    placeholder: {
      marginTop: 14,
      padding: 20,
      borderRadius: 22,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.lineSoft,
    },
    placeholderTitle: { color: colors.inkStrong, fontSize: 15, fontWeight: '800' },
    placeholderBody: { color: colors.body, fontSize: 13, lineHeight: 19, marginTop: 8 },
  });
