import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme } from "@/src/theme";
import { useShops, Station } from "@/src/hooks";
import { inr, secondsUntil, fmtCountdown } from "@/src/format";
import { Chip, Loading, EmptyState, StatusPill, ScreenHeader, Ionicons } from "@/src/ui";

function useTick() {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(t); }, []);
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "PS5", label: "PlayStation" },
  { key: "Gaming PC", label: "Gaming PC" },
  { key: "free", label: "Free" },
  { key: "playing", label: "Playing" },
  { key: "booked", label: "Booked" },
];

export default function Floor() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useTick();
  const { data: shops = [] } = useShops();
  const [shopId, setShopId] = useState("all");
  const [filter, setFilter] = useState("all");

  const q = useQuery({
    queryKey: ["stations", shopId],
    queryFn: () => api.get<Station[]>(`/stations?shop_id=${shopId}`),
    refetchInterval: 15000,
  });

  const stations = (q.data || []).filter((s) => {
    if (filter === "all") return true;
    if (filter === "PS5") return s.type === "PS5" || s.type === "PS4";
    if (filter === "Gaming PC") return s.type === "Gaming PC";
    return s.status === filter;
  });

  const bottomChrome = insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, backgroundColor: colors.surface }}>
        <ScreenHeader title="Gaming Floor" subtitle="Live station telemetry" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          <Chip label="All Shops" active={shopId === "all"} onPress={() => setShopId("all")} testID="floor-shop-all" />
          {shops.map((s) => <Chip key={s.id} label={s.code} active={shopId === s.id} onPress={() => setShopId(s.id)} testID={`floor-shop-${s.code}`} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 10 }}>
          {FILTERS.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} testID={`floor-filter-${f.key}`} />)}
        </ScrollView>
      </View>

      {q.isLoading ? <Loading testID="floor-loading" /> : stations.length === 0 ? (
        <EmptyState icon="game-controller-outline" text="No stations match this filter" testID="floor-empty" />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomChrome + 90 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {stations.map((st) => {
              const isPs = st.type !== "Gaming PC";
              const remaining = st.active_session ? secondsUntil(st.active_session.planned_end) : 0;
              const warn = st.status === "playing" && remaining <= 600;
              return (
                <Pressable
                  key={st.id}
                  testID={`station-card-${st.name}`}
                  onPress={() => router.push(`/station/${st.id}`)}
                  style={{
                    width: "47.5%", backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: warn ? colors.stationPlaying : colors.border, minHeight: 138,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }}>{st.name}</Text>
                    <Ionicons name={isPs ? "logo-playstation" : "desktop-outline"} size={16} color={isPs ? colors.rigPs5 : colors.rigPc} />
                  </View>
                  <View style={{ marginTop: 8 }}><StatusPill status={st.status} /></View>

                  {st.status === "playing" && st.active_session ? (
                    <View style={{ marginTop: 8 }}>
                      <Text numberOfLines={1} style={{ color: colors.onSurfaceSecondary, fontSize: 13 }}>{st.current_customer || "Guest"}</Text>
                      {st.current_game ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{st.current_game}</Text> : null}
                      <Text style={{ color: warn ? colors.stationPlaying : colors.brandPrimary, fontSize: 18, fontWeight: "600", marginTop: 4, fontVariant: ["tabular-nums"] }}>
                        {remaining < 0 ? "EXPIRED" : fmtCountdown(remaining)}
                      </Text>
                    </View>
                  ) : st.status === "booked" && st.next_booking ? (
                    <Text style={{ color: colors.stationBooked, fontSize: 13, marginTop: 8 }}>{st.next_booking.start_time}</Text>
                  ) : (
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>{inr(st.hourly_rate)}/hr</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Pressable
        testID="new-session-fab"
        onPress={() => router.push("/new-session")}
        style={{ position: "absolute", right: 16, bottom: bottomChrome + 16, backgroundColor: colors.brandPrimary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 15, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
        <Text style={{ color: colors.onBrandPrimary, fontSize: 15, fontWeight: "600" }}>New Session</Text>
      </Pressable>
    </View>
  );
}
