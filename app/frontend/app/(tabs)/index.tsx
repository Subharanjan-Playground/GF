import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { useShops } from "@/src/hooks";
import { inr } from "@/src/format";
import { Card, Chip, Loading, ScreenHeader, Ionicons } from "@/src/ui";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default function Dashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: shops = [] } = useShops();
  const [shopId, setShopId] = useState("all");
  const [range, setRange] = useState("today");

  const dash = useQuery({ queryKey: ["dashboard", shopId, range], queryFn: () => api.get<any>(`/dashboard?shop_id=${shopId}&range=${range}`) });
  const cmp = useQuery({ queryKey: ["dashboard-shops"], queryFn: () => api.get<any[]>("/dashboard/shops") });

  const d = dash.data;
  const kpis = d ? [
    { label: "Total Revenue", value: inr(d.total_revenue), icon: "cash-outline", accent: colors.brandPrimary },
    { label: "Gaming", value: inr(d.gaming_revenue), icon: "game-controller-outline", accent: colors.rigPs5 },
    { label: "Snacks", value: inr(d.snack_revenue), icon: "fast-food-outline", accent: colors.rigPc },
    { label: "Active Sessions", value: String(d.active_sessions), icon: "pulse-outline", accent: colors.stationPlaying },
    { label: "Bookings", value: String(d.today_bookings), icon: "calendar-outline", accent: colors.stationBooked },
    { label: "Occupancy", value: `${d.occupancy}%`, icon: "speedometer-outline", accent: colors.info },
    { label: "Available", value: String(d.available_stations), icon: "checkmark-circle-outline", accent: colors.success },
    { label: "Low Stock", value: String(d.low_stock_items), icon: "alert-circle-outline", accent: colors.warning },
  ] : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={dash.isFetching} onRefresh={() => { dash.refetch(); cmp.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        <ScreenHeader
          title={`Hi, ${user?.name?.split(" ")[0] || "there"}`}
          subtitle={`${user?.role?.toUpperCase()} · NexusArena`}
          right={<Pressable testID="logout-button" onPress={logout} hitSlop={10}><Ionicons name="log-out-outline" size={24} color={colors.muted} /></Pressable>}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          <Chip label="All Shops" active={shopId === "all"} onPress={() => setShopId("all")} testID="shop-all" />
          {shops.map((s) => <Chip key={s.id} label={s.code} active={shopId === s.id} onPress={() => setShopId(s.id)} testID={`shop-${s.code}`} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
          {RANGES.map((r) => <Chip key={r.key} label={r.label} active={range === r.key} onPress={() => setRange(r.key)} testID={`range-${r.key}`} />)}
        </ScrollView>

        {dash.isLoading ? <Loading testID="dashboard-loading" /> : (
          <View testID="kpi-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
            {kpis.map((k) => (
              <Card key={k.label} style={{ width: "47.5%", padding: 14 }}>
                <Ionicons name={k.icon as any} size={20} color={k.accent} />
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "600", marginTop: 10 }}>{k.value}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{k.label}</Text>
              </Card>
            ))}
          </View>
        )}

        <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600", marginTop: 24, marginBottom: 12 }}>Shop Comparison</Text>
        {(cmp.data || []).map((s) => (
          <Card key={s.shop_id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "600" }}>{s.name}</Text>
              <View style={{ backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 12 }}>{s.occupancy}% full</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[["Revenue", inr(s.revenue)], ["Sessions", String(s.sessions)], ["Active", String(s.active_players)]].map(([l, v]) => (
                <View key={l}>
                  <Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "600" }}>{v}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{l}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
