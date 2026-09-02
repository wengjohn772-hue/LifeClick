import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { authenticate, saveLocation, TrustedContact } from './lib/api';

type AuthMode = 'login' | 'register';
type Tab = 'checkin' | 'map' | 'faf' | 'feeds' | 'safety' | 'settings';

type User = { id: string | number; name: string; email: string; phone?: string; address?: string; fafId?: string };
const BACKGROUND_LOCATION_TASK = 'lifeclick-background-location';
let activeUserId: string | number | undefined;
const SESSION_KEY = 'lifeclick.session';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
  const latest = locations[locations.length - 1];
  const storedSession = await SecureStore.getItemAsync(SESSION_KEY);
  const storedUser = storedSession ? JSON.parse(storedSession) as { id?: string | number } : null;
  const userId = activeUserId ?? storedUser?.id;
  if (latest && userId) {
    await saveLocation({ userId, latitude: latest.coords.latitude, longitude: latest.coords.longitude, accuracy: latest.coords.accuracy ?? 0, status: 'background' });
  }
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    void SecureStore.getItemAsync(SESSION_KEY).then((storedSession) => {
      if (!storedSession) return;
      const storedUser = JSON.parse(storedSession) as User;
      activeUserId = storedUser.id;
      setUser(storedUser);
    }).catch(() => undefined);
  }, []);
  const authenticateUser = (nextUser: User) => { activeUserId = nextUser.id; setUser(nextUser); void SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextUser)); };
  const logout = () => { activeUserId = undefined; void SecureStore.deleteItemAsync(SESSION_KEY); setUser(null); };
  return user ? <MobileShell user={user} onLogout={logout} /> : <AuthScreen onAuthenticated={authenticateUser} />;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    setMessage('');
    if (!email.trim() || !password.trim() || (mode === 'register' && (!name.trim() || !phone.trim() || !address.trim()))) {
      setMessage('Complete the required fields before continuing.');
      return;
    }
    const trustedContacts: TrustedContact[] = contactName.trim() && contactPhone.trim()
      ? [{ name: contactName.trim(), phone: contactPhone.trim(), relation: contactRelation.trim() || 'Trusted contact' }]
      : [];
    setBusy(true);
    try {
      const result = await authenticate({ mode, email: email.trim(), password, name: name.trim(), phone: phone.trim(), address: address.trim(), trustedContacts });
      onAuthenticated(result.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect to LifeClick.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.glow} />
          <View style={styles.brandRow}><View style={styles.pulseDot} /><Text style={styles.brand}>LifeClick</Text></View>
          <Text style={styles.eyebrow}>{mode === 'login' ? 'Personal safety, made simple' : 'Build your safety circle'}</Text>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>Your check-ins, trusted contacts, and safety signals in one protected place.</Text>
          <View style={styles.switcher}>
            {(['login', 'register'] as AuthMode[]).map((item) => <Pressable key={item} onPress={() => { setMode(item); setMessage(''); }} style={[styles.switchButton, mode === item && styles.switchButtonActive]}><Text style={[styles.switchText, mode === item && styles.switchTextActive]}>{item === 'login' ? 'Sign in' : 'Create account'}</Text></Pressable>)}
          </View>
          <View style={styles.formCard}>
            {mode === 'register' && <>
              <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
              <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="Your phone number" keyboardType="phone-pad" />
              <Field label="Address" value={address} onChangeText={setAddress} placeholder="Your address" multiline />
              <View style={styles.contactBlock}><Text style={styles.contactTitle}>Trusted contact (optional)</Text><Field label="Name" value={contactName} onChangeText={setContactName} placeholder="Contact name" compact /><Field label="Phone" value={contactPhone} onChangeText={setContactPhone} placeholder="Contact number" keyboardType="phone-pad" compact /><Field label="Relationship" value={contactRelation} onChangeText={setContactRelation} placeholder="Friend, family, colleague" compact /></View>
            </>}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
            <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Connecting...' : mode === 'login' ? 'Continue' : 'Create account'}</Text></Pressable>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MobileShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('checkin');
  const [checkInAt, setCheckInAt] = useState(Date.now() + 30 * 60 * 1000);
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationMessage, setLocationMessage] = useState('Location is waiting for permission.');
  const [friendId, setFriendId] = useState('');
  const [connectedFriend, setConnectedFriend] = useState('');
  const [missedClicks, setMissedClicks] = useState(0);

  const scheduleReminder = async (deadline: number) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const secondsUntilReminder = Math.max(1, Math.floor((deadline - Date.now()) / 1000) - 5 * 60);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'LifeClick reminder', body: 'Your safety check-in is due in five minutes.', sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsUntilReminder, repeats: false },
    });
  };

  useEffect(() => {
    void Notifications.requestPermissionsAsync();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permission.status !== Location.PermissionStatus.GRANTED) { setLocationMessage('Allow location in device settings to show your position.'); return; }
      setLocationMessage('Live location monitoring is active.');
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 10 }, setLocation);
      const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      if (backgroundPermission.status === Location.PermissionStatus.GRANTED) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 50, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: 'LifeClick location active', notificationBody: 'Safety monitoring is running.' } });
      }
    })();
    return () => { cancelled = true; subscription?.remove(); void Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).then((started) => { if (started) return Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); }); };
  }, []);

  useEffect(() => { void scheduleReminder(checkInAt); return () => { void Notifications.cancelAllScheduledNotificationsAsync(); }; }, [checkInAt]);

  const remaining = Math.max(0, Math.ceil((checkInAt - now) / 1000));
  const checkIn = () => { const at = new Date(); setLastCheckIn(at); setCheckInAt(Date.now() + 30 * 60 * 1000); };
  const content = tab === 'checkin' ? <CheckInScreen remaining={remaining} lastCheckIn={lastCheckIn} onCheckIn={checkIn} /> : tab === 'map' ? <MapScreen location={location} message={locationMessage} /> : tab === 'faf' ? <FafScreen friendId={friendId} onFriendIdChange={setFriendId} connectedFriend={connectedFriend} onConnect={() => setConnectedFriend(friendId.trim().toUpperCase())} /> : tab === 'feeds' ? <FeedsScreen /> : tab === 'safety' ? <SafetyScreen remaining={remaining} lastCheckIn={lastCheckIn} missedClicks={missedClicks} /> : <SettingsScreen user={user} onLogout={onLogout} />;
  return <SafeAreaView style={styles.appSafe}><StatusBar style="dark" /><View style={styles.appBody}>{content}</View><View style={styles.tabBar}>{(['checkin', 'map', 'faf', 'feeds', 'safety', 'settings'] as Tab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabIcon, tab === item && styles.tabIconActive]}>{item === 'checkin' ? '✓' : item === 'map' ? '⌖' : item === 'faf' ? '♙' : item === 'feeds' ? '▤' : item === 'safety' ? '◉' : '⚙'}</Text><Text style={[styles.tabLabel, tab === item && styles.tabLabelActive]}>{item === 'checkin' ? 'Check in' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View></SafeAreaView>;
}

function CheckInScreen({ remaining, lastCheckIn, onCheckIn }: { remaining: number; lastCheckIn: Date | null; onCheckIn: () => void }) {
  return <ScrollView contentContainerStyle={styles.screenContent}><Text style={styles.screenEyebrow}>LifeClick safety</Text><Text style={styles.screenTitle}>Check in</Text><Text style={styles.screenSubtitle}>One tap tells your circle you are okay.</Text><View style={styles.timerCard}><Text style={styles.cardLabel}>NEXT CHECK-IN</Text><Text style={styles.timer}>{`${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`}</Text><Text style={styles.cardHint}>Your timer keeps running while you move through the app.</Text></View><Pressable onPress={onCheckIn} style={({ pressed }) => [styles.checkButton, pressed && styles.pressed]}><Text style={styles.checkButtonText}>I'm safe</Text><Text style={styles.checkButtonHint}>Tap to reset timer</Text></Pressable><Text style={styles.lastSignal}>{lastCheckIn ? `Confirmed at ${lastCheckIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No check-in yet today.'}</Text></ScrollView>;
}

function MapScreen({ location, message }: { location: Location.LocationObject | null; message: string }) {
  const coordinate = location ? { latitude: location.coords.latitude, longitude: location.coords.longitude } : { latitude: 40.7128, longitude: -74.006 };
  const region: Region = { ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 };
  return <ScrollView contentContainerStyle={styles.screenContent}><Text style={styles.screenEyebrow}>Live location</Text><Text style={styles.screenTitle}>Map</Text><Text style={styles.screenSubtitle}>{message}</Text><View style={styles.mapPreview}><MapView style={styles.nativeMap} provider={PROVIDER_DEFAULT} mapType="satellite" initialRegion={region} region={region} showsUserLocation={Boolean(location)} showsMyLocationButton={Boolean(location)}><Marker coordinate={coordinate} title={location ? 'Your location' : 'Preview location'} description={location ? 'Live location received' : 'Allow location to update this pin'} /></MapView><View style={styles.mapOverlay}><Text style={styles.mapPreviewTitle}>{location ? 'Your location received' : 'Satellite preview'}</Text><Text style={styles.mapPreviewText}>{`${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`}</Text></View></View></ScrollView>;
}

function FafScreen({ friendId, onFriendIdChange, connectedFriend, onConnect }: { friendId: string; onFriendIdChange: (value: string) => void; connectedFriend: string; onConnect: () => void }) { return <ScrollView contentContainerStyle={styles.screenContent}><Text style={styles.screenEyebrow}>Safety circle</Text><Text style={styles.screenTitle}>Find a Friend</Text><Text style={styles.screenSubtitle}>Connect by FaF ID to share live safety status.</Text><View style={styles.formCard}><Field label="FaF ID" value={friendId} onChangeText={onFriendIdChange} placeholder="FAF-0000" autoCapitalize="characters" /><Pressable onPress={onConnect} disabled={!friendId.trim()} style={[styles.primaryButton, !friendId.trim() && styles.disabled]}><Text style={styles.primaryText}>Connect friend</Text></Pressable>{connectedFriend ? <Text style={styles.message}>Connected to {connectedFriend}</Text> : null}</View><Metric label="Blue Kite" value="400 m · Safe" /><Metric label="Night Owl" value="2.1 km · Safe" /><Metric label="Red Lantern" value="Last seen 6h ago" /></ScrollView>; }
function FeedsScreen() { const posts = [{ id: 'user-7F42', area: 'Riverside Dr.', tag: 'Notice', body: 'Streetlights are out along the whole stretch past the bridge.' }, { id: 'user-3K91', area: 'Market Square', tag: 'Alert', body: 'Keep devices out of sight while waiting near the taxi rank.' }, { id: 'user-8M16', area: 'Campus North', tag: 'Resolved', body: 'The reported student has been found safe and is back home.' }]; return <ScrollView contentContainerStyle={styles.screenContent}><Text style={styles.screenEyebrow}>Community safety</Text><Text style={styles.screenTitle}>Feeds</Text><Text style={styles.screenSubtitle}>Anonymous updates from around the city.</Text>{posts.map((post) => <View key={post.id} style={styles.postCard}><View style={styles.postHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{post.id.slice(-2)}</Text></View><View style={styles.postMeta}><Text style={styles.postUser}>{post.id}</Text><Text style={styles.postArea}>{post.area} · Today</Text></View><Text style={styles.postTag}>{post.tag}</Text></View><Text style={styles.postBody}>{post.body}</Text><View style={styles.postActions}><Text style={styles.actionText}>♡ 0</Text><Text style={styles.actionText}>↻ 0</Text></View></View>)}</ScrollView>; }
function SafetyScreen({ remaining, lastCheckIn, missedClicks }: { remaining: number; lastCheckIn: Date | null; missedClicks: number }) { const behavior = Math.max(0, 100 - missedClicks * 10); const risk = Math.min(100, missedClicks * 18 + (100 - behavior) * 0.35); return <ScrollView contentContainerStyle={styles.screenContent}><Text style={styles.screenEyebrow}>AI safety monitor</Text><Text style={styles.screenTitle}>Safety dashboard</Text><View style={styles.riskCard}><Text style={styles.cardLabel}>CURRENT RISK</Text><Text style={styles.riskLevel}>{risk >= 70 ? 'High' : risk >= 35 ? 'Medium' : 'Low'}</Text><Text style={styles.cardHint}>Assessment uses check-in history and timing signals.</Text></View><Metric label="Behaviour score" value={`${behavior}/100`} /><Metric label="Missed clicks" value={String(missedClicks)} /><Metric label="Next check-in" value={`${Math.ceil(remaining / 60)} min`} /><Metric label="Last signal" value={lastCheckIn ? 'Confirmed' : 'Waiting'} /><Metric label="Location pattern" value="Monitoring" /></ScrollView>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function SimpleScreen({ title, text }: { title: string; text: string }) { return <View style={styles.emptyScreen}><Text style={styles.screenTitle}>{title}</Text><Text style={styles.screenSubtitle}>{text}</Text></View>; }
function SettingsScreen({ user, onLogout }: { user: User; onLogout: () => void }) { return <ScrollView contentContainerStyle={styles.screenContent}><Text style={styles.screenEyebrow}>Account</Text><Text style={styles.screenTitle}>Settings</Text><View style={styles.profileCard}><Text style={styles.profileName}>{user.name}</Text><Text style={styles.profileDetail}>{user.email}</Text><Text style={styles.profileDetail}>{user.fafId || 'FaF ID pending'}</Text></View><Metric label="Notifications" value="Managed by device settings" /><Metric label="Location" value="Managed by device settings" /><Pressable onPress={onLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Sign out</Text></Pressable></ScrollView>; }
function Field(props: ComponentProps<typeof TextInput> & { label: string; compact?: boolean }) { const { label, compact, ...inputProps } = props; return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.label}>{label}</Text><TextInput {...inputProps} placeholderTextColor="#a9a0bc" style={styles.input} /></View>; }

const styles = StyleSheet.create({
  postCard: { marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9def4' },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6d28d9' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  postMeta: { flex: 1, marginLeft: 10 },
  postUser: { color: '#34104d', fontSize: 13, fontWeight: '800' },
  postArea: { color: '#8e8197', fontSize: 11, marginTop: 3 },
  postTag: { color: '#6d28d9', fontSize: 11, fontWeight: '800' },
  postBody: { color: '#55495d', fontSize: 15, lineHeight: 22, marginTop: 14 },
  postActions: { flexDirection: 'row', gap: 20, marginTop: 14 },
  actionText: { color: '#8e8197', fontSize: 13, fontWeight: '700' },
  nativeMap: { ...StyleSheet.absoluteFill },
  mapOverlay: { position: 'absolute', left: 14, right: 14, bottom: 14, padding: 12, borderRadius: 16, backgroundColor: 'rgba(15, 23, 42, 0.78)' },
  safeArea: { flex: 1, backgroundColor: '#08050d' }, flex: { flex: 1 }, authContent: { flexGrow: 1, padding: 24, paddingTop: 44, paddingBottom: 48, backgroundColor: '#08050d' }, glow: { position: 'absolute', top: -120, left: -80, width: 360, height: 360, borderRadius: 180, backgroundColor: '#39126b', opacity: 0.55 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 }, pulseDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: '#d8b4fe', backgroundColor: '#6d28d9' }, brand: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -1 }, eyebrow: { color: '#c4b5fd', fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }, title: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1.2 }, subtitle: { color: '#c8bfd3', fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 350 }, switcher: { flexDirection: 'row', marginTop: 28, padding: 4, borderRadius: 16, backgroundColor: '#1c1229', borderWidth: 1, borderColor: '#3b2750' }, switchButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 }, switchButtonActive: { backgroundColor: '#fff' }, switchText: { color: '#d8cde3', fontSize: 14, fontWeight: '700' }, switchTextActive: { color: '#351050' }, formCard: { marginTop: 16, padding: 18, borderRadius: 24, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }, field: { marginBottom: 15 }, fieldCompact: { marginBottom: 10 }, label: { color: '#443650', fontSize: 12, fontWeight: '700', marginBottom: 7 }, input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e3dbea', backgroundColor: '#faf8fc', color: '#24152e', fontSize: 15 }, contactBlock: { marginBottom: 14, padding: 14, borderRadius: 17, backgroundColor: '#f4effb', borderWidth: 1, borderColor: '#e8dcf5' }, contactTitle: { color: '#5b21b6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }, primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4, borderRadius: 15, backgroundColor: '#6d28d9' }, primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.84 }, disabled: { opacity: 0.55 }, message: { color: '#5b21b6', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14 }, appSafe: { flex: 1, backgroundColor: '#f7f4fb' }, appBody: { flex: 1 }, screenContent: { flexGrow: 1, padding: 24, paddingTop: 28, paddingBottom: 28 }, screenEyebrow: { color: '#6d28d9', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }, screenTitle: { color: '#24152e', fontSize: 34, fontWeight: '800', marginTop: 5 }, screenSubtitle: { color: '#6d6174', fontSize: 15, lineHeight: 23, marginTop: 8 }, timerCard: { marginTop: 28, padding: 22, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9def4', shadowColor: '#6d28d9', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 }, cardLabel: { color: '#8e8197', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }, timer: { color: '#34104d', fontSize: 52, fontWeight: '800', marginTop: 8 }, cardHint: { color: '#7d7183', fontSize: 13, lineHeight: 19, marginTop: 6 }, checkButton: { alignItems: 'center', justifyContent: 'center', width: 210, height: 210, borderRadius: 105, alignSelf: 'center', marginTop: 42, backgroundColor: '#6d28d9', shadowColor: '#6d28d9', shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 }, checkButtonText: { color: '#fff', fontSize: 28, fontWeight: '800' }, checkButtonHint: { color: '#e9d5ff', fontSize: 13, marginTop: 6 }, lastSignal: { color: '#6d28d9', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 28 }, mapPreview: { height: 360, marginTop: 28, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#355448', borderWidth: 1, borderColor: '#fff' }, mapGrid: { ...StyleSheet.absoluteFill, opacity: 0.35, backgroundColor: '#52725b' }, mapPin: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6d28d9', borderWidth: 5, borderColor: '#fff' }, mapPinText: { color: '#fff', fontSize: 28 }, mapPreviewTitle: { color: '#fff', fontWeight: '800', fontSize: 17, marginTop: 18 }, mapPreviewText: { color: '#e6e0e9', fontSize: 13, marginTop: 5 }, riskCard: { marginTop: 26, padding: 22, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9def4' }, riskLevel: { color: '#047857', fontSize: 34, fontWeight: '800', marginTop: 8 }, metric: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#e9def4' }, metricLabel: { color: '#6d6174', fontSize: 15 }, metricValue: { color: '#34104d', fontWeight: '800', fontSize: 15 }, emptyScreen: { flex: 1, padding: 24, paddingTop: 28 }, profileCard: { marginTop: 26, padding: 22, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9def4' }, profileName: { color: '#34104d', fontSize: 22, fontWeight: '800' }, profileDetail: { color: '#6d6174', fontSize: 14, marginTop: 8 }, logoutButton: { alignItems: 'center', marginTop: 18, padding: 16, borderRadius: 15, backgroundColor: '#fee2e2' }, logoutText: { color: '#be123c', fontWeight: '800' }, tabBar: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 4 : 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8dcf5' }, tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 12 }, tabActive: { backgroundColor: '#f0e8ff' }, tabIcon: { color: '#a99caf', fontSize: 19 }, tabIconActive: { color: '#6d28d9' }, tabLabel: { color: '#8e8197', fontSize: 10, marginTop: 3 }, tabLabelActive: { color: '#6d28d9', fontWeight: '800' },
});
