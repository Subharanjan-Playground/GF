import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { ScreenHeader, Ionicons } from "@/src/ui";

const LINKS = [
  { title: "Live Sessions", sub: "Active & past sessions", icon: "pulse-outline", href: "/manage/sessions" },
  { title: "Stations", sub: "Manage PS & PC rigs", icon: "hardware-chip-outline", href: "/manage/stations" },
  { title: "Games", sub: "Game catalogue", icon: "logo-game-controller-b", href: "/manage/games" },
  { title: "Inventory", sub: "Stock & movements", icon: "cube-outline", href: "/manage/inventory" },
  { title: "Customers", sub: "Gamer profiles", icon: "people-outline", href: "/manage/customers" },
  { title: "Reports", sub: "Revenue & analytics", icon: "bar-chart-outline", href: "/manage/reports" },
];

export default function More() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
        <ScreenHeader title="More" subtitle={`${user?.name} · ${user?.role?.toUpperCase()}`} />
        {LINKS.map((l) => (
          <Pressable key={l.href} testID={`more-${l.title}`} onPress={() => router.push(l.href as any)}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={l.icon as any} size={22} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "600" }}>{l.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{l.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable testID="more-logout" onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 12, padding: 14 }}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 15 }}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
