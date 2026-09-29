import React from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }, style]}>
      {children}
    </View>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        height: 36, flexShrink: 0, paddingHorizontal: 16, borderRadius: 999,
        alignItems: "center", justifyContent: "center", borderWidth: 1,
        backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary,
        borderColor: active ? colors.brandPrimary : colors.border,
      }}
    >
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ title, onPress, testID, loading, disabled, icon }: { title: string; onPress?: () => void; testID?: string; loading?: boolean; disabled?: boolean; icon?: any }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: disabled ? colors.surfaceTertiary : colors.brandPrimary,
        borderRadius: 14, paddingVertical: 15, alignItems: "center", justifyContent: "center",
        flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={disabled ? colors.muted : colors.onBrandPrimary} /> : null}
          <Text style={{ color: disabled ? colors.muted : colors.onBrandPrimary, fontSize: 16, fontWeight: "600" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({ icon, text, testID }: { icon: any; text: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: 40, gap: 12 }}>
      <Ionicons name={icon} size={48} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

export function Loading({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { colors } = useTheme();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    free: { bg: colors.stationFree, fg: colors.onStationFree, label: "FREE" },
    playing: { bg: colors.stationPlaying, fg: colors.onStationPlaying, label: "PLAYING" },
    booked: { bg: colors.stationBooked, fg: colors.onStationBooked, label: "BOOKED" },
    maintenance: { bg: colors.stationMaintenance, fg: colors.onStationMaintenance, label: "MAINTENANCE" },
    offline: { bg: colors.stationMaintenance, fg: colors.onStationMaintenance, label: "OFFLINE" },
  };
  const s = map[status] || map.free;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" }}>
      <Text style={{ color: s.fg, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }}>{s.label}</Text>
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: React.ReactNode; onBack?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 }}>
      {onBack ? (
        <Pressable testID="back-button" onPress={onBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export { Ionicons };
