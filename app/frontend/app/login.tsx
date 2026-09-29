import { useState } from "react";
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";
import { PrimaryButton, Ionicons } from "@/src/ui";

const DEMO = [
  { role: "Owner", email: "owner@nexus.com", password: "Owner@123" },
  { role: "Manager", email: "manager@nexus.com", password: "Manager@123" },
  { role: "Staff", email: "staff@nexus.com", password: "Staff@123" },
  { role: "Customer", email: "customer@nexus.com", password: "Customer@123" },
];

export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("owner@nexus.com");
  const [password, setPassword] = useState("Owner@123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const input = { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: colors.border } as const;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong }}>
            <Ionicons name="game-controller" size={34} color={colors.brandPrimary} />
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "600", marginTop: 14 }}>NexusArena</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>Gaming Café Operations Console</Text>
        </View>

        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginBottom: 6 }}>EMAIL</Text>
        <TextInput testID="login-email-input" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@nexus.com" placeholderTextColor={colors.muted} style={input} />
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginBottom: 6, marginTop: 14 }}>PASSWORD</Text>
        <TextInput testID="login-password-input" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.muted} style={input} />

        {error ? <Text testID="login-error" style={{ color: colors.error, fontSize: 13, marginTop: 12 }}>{error}</Text> : null}

        <View style={{ marginTop: 22 }}>
          <PrimaryButton testID="login-submit-button" title="Access Floor Console" onPress={submit} loading={busy} icon="log-in-outline" />
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 28, marginBottom: 10 }}>Quick demo login</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DEMO.map((d) => (
            <Pressable key={d.role} testID={`demo-${d.role.toLowerCase()}`} onPress={() => { setEmail(d.email); setPassword(d.password); }}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: 13 }}>{d.role}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
