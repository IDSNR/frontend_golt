import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
const GOOGLE_PLACEHOLDER = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'replace-me-google-client-id';

export default function App() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('P@ssword123');
  const [displayName, setDisplayName] = useState('Demo User');
  const [loading, setLoading] = useState(false);

  async function submitAuth() {
    const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login';
    const body = mode === 'signup'
      ? { email, password, displayName }
      : { email, password };

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }
      Alert.alert('Success', `Welcome ${data.user?.displayName || email}`);
    } catch (error) {
      Alert.alert('Auth error', error instanceof Error ? error.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || 'google-placeholder@example.com',
          displayName: displayName || 'Google user',
          googleId: GOOGLE_PLACEHOLDER,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Google auth failed');
      }
      Alert.alert('Google ready', 'Swap the placeholder Google client ID in the env file when you have real credentials.');
    } catch (error) {
      Alert.alert('Google error', error instanceof Error ? error.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>PartnerHub</Text>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              This is the first step in a more complete onboarding flow for phone, consent, and profile setup later.
            </Text>
          </View>

          <View style={styles.tabs}>
            <Pressable style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => setMode('signup')}>
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign up</Text>
            </Pressable>
            <Pressable style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => setMode('login')}>
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Log in</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {mode === 'signup' ? (
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor="#94a3b8"
                value={displayName}
                onChangeText={setDisplayName}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Pressable style={styles.primaryButton} onPress={submitAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#111827" /> : <Text style={styles.primaryButtonText}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text>}
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={continueWithGoogle} disabled={loading}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.secondaryButtonText}>Continue with Google</Text>}
            </Pressable>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Onboarding-ready</Text>
            <Text style={styles.noteText}>The screen is structured so you can slot in phone-number verification, consent, and profile setup before the first feed appears.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#07110a',
  },
  content: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: '#14241b',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,204,44,0.25)',
  },
  eyebrow: {
    color: '#ffcc2c',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#14241b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: '#6bcc61',
  },
  tabText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#07110a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7e0d4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#ffcc2c',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#6bcc61',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#07110a',
    fontWeight: '700',
  },
  noteCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,204,44,0.2)',
  },
  noteTitle: {
    color: '#ffcc2c',
    fontWeight: '700',
    marginBottom: 6,
  },
  noteText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 20,
  },
});
