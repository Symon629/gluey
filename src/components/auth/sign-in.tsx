import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { KeyboardAvoidingView } from '@/components/keyboard';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signIn, signUp } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase/client';

type Mode = 'signIn' | 'signUp';

export function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === 'signIn') {
      setError(await signIn(email, password));
    } else {
      const result = await signUp(email, password);
      if (result.error) setError(result.error);
      else if (result.confirmEmail) {
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('signIn');
      }
    }
    setBusy(false);
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <ThemedText style={styles.title} accessibilityRole="header">
              {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Your notes and chats are saved to your account so they follow you to any device.
            </ThemedText>

            {!supabaseConfigured ? (
              <ThemedText themeColor="danger">
                Sign-in isn&apos;t set up yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to
                .env.local and restart the dev server.
              </ThemedText>
            ) : null}

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email"
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (6+ characters)"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
              accessibilityLabel="Password"
              onSubmitEditing={() => canSubmit && void submit()}
              style={inputStyle}
            />

            {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
            {info ? <ThemedText themeColor="success">{info}</ThemedText> : null}

            <Button
              label={mode === 'signIn' ? 'Sign in' : 'Create account'}
              onPress={() => void submit()}
              loading={busy}
              disabled={!canSubmit || !supabaseConfigured}
            />
            <Button
              variant="secondary"
              label={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
              onPress={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setError(null);
                setInfo(null);
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.three,
  },
  form: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
});
