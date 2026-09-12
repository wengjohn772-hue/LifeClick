import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Field } from '../components/Field';
import { GradientScreen } from '../components/GradientScreen';
import { TAG_TONE } from '../components/PostCard';
import { createPost } from '../lib/api';
import { useTheme } from '../state/theme';
import type { Palette } from '../theme';
import { FEED_TAGS } from '../types';
import type { FeedPost, FeedTag } from '../types';

const MAX_BODY = 1000;

interface PickedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

const TAG_HINT: Record<FeedTag, string> = {
  Alert: 'Something happening now that others should avoid or watch out for.',
  Update: 'New information about a situation already reported.',
  Resolved: 'A previously reported problem that is now over.',
  Notice: 'General information worth knowing, not urgent.',
};

export function ComposePostScreen({ onClose, onPosted }: { onClose: () => void; onPosted: (post: FeedPost) => void }) {
  const { colors, shared } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tagTone = useMemo(() => TAG_TONE(colors), [colors]);

  const [body, setBody] = useState('');
  const [tag, setTag] = useState<FeedTag>('Notice');
  const [area, setArea] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /**
   * Images are downscaled and re-encoded on device before upload. A modern
   * phone camera produces 3-8 MB files, which would blow past the API's limit
   * and waste the user's data.
   */
  const processAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<PickedImage | null> => {
    // Height is omitted so the aspect ratio is preserved automatically.
    const context = ImageManipulator.manipulate(asset.uri).resize({ width: 1280 });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });

    if (!result.base64) return null;
    return { uri: result.uri, base64: result.base64, width: result.width, height: result.height };
  };

  const pickFrom = async (source: 'camera' | 'library') => {
    setError('');
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(
          source === 'camera'
            ? 'Camera permission is needed to take a photo. Enable it in device settings.'
            : 'Photo permission is needed to attach an image. Enable it in device settings.'
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.[0]) return;

      const processed = await processAsset(result.assets[0]);
      if (!processed) {
        setError('That image could not be prepared. Try another one.');
        return;
      }
      setImage(processed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the image picker.');
    }
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (trimmed.length < 4) {
      setError('Write a little more so others understand the report.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await createPost({
        body: trimmed,
        tag,
        area: area.trim() || undefined,
        state: state.trim() || undefined,
        country: country.trim() || undefined,
        ...(image
          ? { image: { base64: image.base64, mimeType: 'image/jpeg', width: image.width, height: image.height } }
          : {}),
      });
      onPosted(result.post);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not publish your report.');
    } finally {
      setBusy(false);
    }
  };

  const confirmClose = () => {
    if (!body.trim() && !image) {
      onClose();
      return;
    }
    Alert.alert('Discard report?', 'Your draft will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GradientScreen>
        <View style={styles.headerRow}>
          <Pressable onPress={confirmClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={shared.screenEyebrow}>Community safety</Text>
        <Text style={shared.screenTitle}>New report</Text>
        <Text style={shared.screenSubtitle}>Posted anonymously — your name is never shown.</Text>

        {/* Guidelines */}
        <View style={styles.guidelines}>
          <Text style={styles.guidelinesTitle}>Before you post</Text>
          <Text style={styles.guidelinesBody}>
            Reports are reviewed and must follow the community guidelines. Only share what you have seen yourself.
            Posting false or misleading information may result in a penalty or removal of your account.
          </Text>
        </View>

        {/* Tag */}
        <Text style={shared.sectionTitle}>Label</Text>
        <View style={styles.tagRow}>
          {FEED_TAGS.map((item) => {
            const active = item === tag;
            const tone = tagTone[item] ?? colors.brand;
            return (
              <Pressable
                key={item}
                onPress={() => setTag(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.tagChip,
                  { borderColor: active ? tone : colors.line },
                  active && { backgroundColor: `${tone}1f` },
                ]}
              >
                <Text style={[styles.tagChipText, { color: active ? tone : colors.body }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.tagHint}>{TAG_HINT[tag]}</Text>

        {/* Body */}
        <Text style={shared.sectionTitle}>What happened?</Text>
        <View style={shared.formCard}>
          <Field
            label="Report"
            value={body}
            onChangeText={(value) => setBody(value.slice(0, MAX_BODY))}
            placeholder="Describe what you saw, where, and when."
            multiline
            numberOfLines={5}
            style={styles.bodyInput}
          />
          <Text style={styles.counter}>{`${body.length}/${MAX_BODY}`}</Text>

          <Field label="Area" value={area} onChangeText={setArea} placeholder="e.g. Ikeja GRA" compact />
          <Field label="State" value={state} onChangeText={setState} placeholder="e.g. Lagos" compact />
          <Field label="Country" value={country} onChangeText={setCountry} placeholder="e.g. Nigeria" compact />
        </View>

        {/* Photo */}
        <Text style={shared.sectionTitle}>Photo (optional)</Text>
        {image ? (
          <View>
            <Image source={{ uri: image.uri }} style={styles.preview} contentFit="cover" />
            <View style={styles.imageActions}>
              <Pressable onPress={() => void pickFrom('library')} style={styles.imageActionButton}>
                <Text style={styles.imageActionText}>Replace</Text>
              </Pressable>
              <Pressable onPress={() => setImage(null)} style={styles.imageActionButton}>
                <Text style={[styles.imageActionText, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.pickerRow}>
            <Pressable
              onPress={() => void pickFrom('camera')}
              style={({ pressed }) => [styles.pickerButton, pressed && shared.pressed]}
            >
              <Text style={styles.pickerIcon}>⊙</Text>
              <Text style={styles.pickerLabel}>Take photo</Text>
            </Pressable>
            <Pressable
              onPress={() => void pickFrom('library')}
              style={({ pressed }) => [styles.pickerButton, pressed && shared.pressed]}
            >
              <Text style={styles.pickerIcon}>▣</Text>
              <Text style={styles.pickerLabel}>Upload</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={busy || body.trim().length < 4}
          style={({ pressed }) => [
            shared.primaryButton,
            styles.submit,
            pressed && shared.pressed,
            (busy || body.trim().length < 4) && shared.disabled,
          ]}
        >
          <Text style={shared.primaryText}>{busy ? 'Posting…' : 'Post report'}</Text>
        </Pressable>

        {error ? <Text style={[shared.message, shared.errorMessage]}>{error}</Text> : null}
      </GradientScreen>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    headerRow: { marginBottom: 12 },
    cancel: { color: colors.brand, fontSize: 15, fontWeight: '700' },
    guidelines: {
      marginTop: 20,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.warnSoft,
      borderWidth: 1,
      borderColor: `${colors.warn}44`,
    },
    guidelinesTitle: { color: colors.warn, fontSize: 13, fontWeight: '800' },
    guidelinesBody: { color: colors.warn, fontSize: 12, lineHeight: 18, marginTop: 6 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    tagChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
    tagChipText: { fontSize: 13, fontWeight: '800' },
    tagHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
    bodyInput: { minHeight: 120, textAlignVertical: 'top' },
    counter: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: -8, marginBottom: 12 },
    pickerRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    pickerButton: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 22,
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.brand,
      backgroundColor: colors.brandSoft,
    },
    pickerIcon: { color: colors.brand, fontSize: 24 },
    pickerLabel: { color: colors.brand, fontSize: 13, fontWeight: '800' },
    preview: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: 18,
      marginTop: 14,
      backgroundColor: colors.brandSoft,
    },
    imageActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    imageActionButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.brandSoft,
    },
    imageActionText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
    submit: { marginTop: 24 },
  });
