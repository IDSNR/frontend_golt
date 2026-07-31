import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PartnerHub Mobile</Text>
          <Text style={styles.title}>A clean starter for iOS and Android</Text>
          <Text style={styles.subtitle}>
            This skeleton includes a simple home screen, cards, and a layout ready for your next feature.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Getting started</Text>
          <Text style={styles.cardText}>Add screens, navigation, and API hooks here.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cross-platform ready</Text>
          <Text style={styles.cardText}>Built with React Native and Expo for both Apple and Android devices.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 24,
    paddingTop: 56,
  },
  hero: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});
