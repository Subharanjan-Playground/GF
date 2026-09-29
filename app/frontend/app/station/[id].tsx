import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme } from "@/src/theme";
import { Station, Product, Game } from "@/src/hooks";
import { inr, secondsUntil, fmtCountdown, fmtTime } from "@/src/format";
import { Loading, StatusPill, ScreenHeader, PrimaryButton, EmptyState, Chip, Ionicons } from "@/src/ui";

function useTick() { const [, s] = useState(0); useEffect(() => { const t = setInterval(() => s((n) => n + 1), 1000); return () => clearInterval(t); }, []); }

export default function StationDetail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  useTick();
  const [snackOpen, setSnackOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);

  const stations = useQuery({ queryKey: ["stations", "all"], queryFn: () => api.get<Station[]>("/stations?shop_id=all") });
  const station = (stations.data || []).find((s) => s.id === id);
  const sessId = station?.active_session?.id;
  const session = useQuery({ queryKey: ["session", sessId], queryFn: () => api.get<any>(`/sessions/${sessId}`), enabled: !!sessId, refetchInterval: 10000 });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["stations"] }); qc.invalidateQueries({ queryKey: ["session", sessId] }); };

  const extend = async (mins: number) => { await api.post(`/sessions/${sessId}/extend`, { minutes: mins }); refresh(); };
  const endSession = async () => { await api.post(`/sessions/${sessId}/end`); refresh(); router.back(); };

  if (stations.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading testID="station-loading" /></View>;
  if (!station) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 40 }}><EmptyState icon="alert-circle-outline" text="Station not found" /></View>;

  const s = session.data;
  const remaining = s ? secondsUntil(s.planned_end) : 0;
  const warn = remaining <= 600;
  const bottom = insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: bottom + 24 }}>
        <ScreenHeader title={station.name} subtitle={station.description} onBack={() => router.back()} right={<StatusPill status={station.status} />} />

        {station.status === "playing" && s ? (
          <>
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: warn ? colors.stationPlaying : colors.border, marginTop: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{remaining < 0 ? "OVERTIME" : "REMAINING"}</Text>
              <Text testID="live-countdown" style={{ color: warn ? colors.stationPlaying : colors.brandPrimary, fontSize: 46, fontWeight: "600", fontVariant: ["tabular-nums"], marginTop: 4 }}>
                {remaining < 0 ? "EXPIRED" : fmtCountdown(remaining)}
              </Text>
              {warn && remaining >= 0 ? <Text style={{ color: colors.warning, fontSize: 13, marginTop: 4 }}>Less than 10 minutes left</Text> : null}
            </View>

            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: colors.border }}>
              {[["Customer", s.customer_name], ["Game", s.game_name || "None"], ["Started", fmtTime(s.start_time)], ["Planned End", fmtTime(s.planned_end)]].map(([l, v]) => (
                <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{l}</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 14 }}>{v}</Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 8 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>Gaming</Text><Text style={{ color: colors.onSurface, fontSize: 14 }}>{inr(s.gaming_amount)}</Text>
              </View>
              {(s.snacks || []).map((sn: any, i: number) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>  {sn.name} × {sn.qty}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>{inr(sn.line_total)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>Snacks</Text><Text style={{ color: colors.onSurface, fontSize: 14 }}>{inr(s.snack_amount)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 8 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "600" }}>Current Bill</Text>
                <Text testID="current-bill" style={{ color: colors.brandPrimary, fontSize: 18, fontWeight: "600" }}>{inr(s.total)}</Text>
              </View>
            </View>

            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 18, marginBottom: 8 }}>ADD TIME</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[[15, "+15m"], [30, "+30m"], [60, "+1h"]].map(([m, l]) => (
                <Pressable key={l as string} testID={`extend-${m}`} onPress={() => extend(m as number)} style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.brandPrimary, fontSize: 14 }}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable testID="add-snack-btn" onPress={() => setSnackOpen(true)} style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="fast-food-outline" size={16} color={colors.brandPrimary} /><Text style={{ color: colors.brandPrimary, fontSize: 14 }}>Add Snack</Text>
              </Pressable>
              <Pressable testID="change-game-btn" onPress={() => setGameOpen(true)} style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.brandPrimary} /><Text style={{ color: colors.brandPrimary, fontSize: 14 }}>Change Game</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 16 }}>
              <PrimaryButton testID="end-session-btn" title={`End Session · ${inr(s.total)}`} onPress={endSession} icon="stop-circle-outline" />
            </View>
          </>
        ) : (
          <View style={{ alignItems: "center", marginTop: 40, gap: 16 }}>
            <Ionicons name={station.type === "Gaming PC" ? "desktop-outline" : "logo-playstation"} size={64} color={station.type === "Gaming PC" ? colors.rigPc : colors.rigPs5} />
            <Text style={{ color: colors.onSurface, fontSize: 18 }}>{station.name} is {station.status}</Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>{inr(station.hourly_rate)}/hour</Text>
            {station.status === "free" ? (
              <View style={{ width: "100%", marginTop: 12 }}>
                <PrimaryButton testID="start-here-btn" title="Start Session Here" onPress={() => router.push({ pathname: "/new-session", params: { station: station.id } })} icon="play" />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <SnackModal visible={snackOpen} onClose={() => setSnackOpen(false)} shopId={station.shop_id} sessionId={sessId} onDone={refresh} bottom={bottom} />
      <GameModal visible={gameOpen} onClose={() => setGameOpen(false)} sessionId={sessId} onDone={refresh} bottom={bottom} />
    </View>
  );
}

function SnackModal({ visible, onClose, shopId, sessionId, onDone, bottom }: any) {
  const { colors } = useTheme();
  const [cart, setCart] = useState<Record<string, number>>({});
  const products = useQuery({ queryKey: ["products", shopId], queryFn: () => api.get<Product[]>(`/products?shop_id=${shopId}`), enabled: visible });
  const items = Object.entries(cart).filter(([, q]) => q > 0);
  const add = async () => {
    await api.post(`/sessions/${sessionId}/snacks`, { items: items.map(([product_id, qty]) => ({ product_id, qty })) });
    setCart({}); onClose(); onDone();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: bottom + 20, maxHeight: "80%" }}>
          <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Add Snacks</Text>
          <ScrollView>
            {(products.data || []).map((p) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
                <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 14 }}>{p.name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{inr(p.selling_price)}</Text></View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Pressable testID={`snack-minus-${p.name}`} onPress={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}><Ionicons name="remove-circle-outline" size={26} color={colors.muted} /></Pressable>
                  <Text style={{ color: colors.onSurface, fontSize: 15, minWidth: 20, textAlign: "center" }}>{cart[p.id] || 0}</Text>
                  <Pressable testID={`snack-plus-${p.name}`} onPress={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}><Ionicons name="add-circle" size={26} color={colors.brandPrimary} /></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={{ marginTop: 12 }}><PrimaryButton testID="snack-confirm" title="Add to Session" onPress={add} disabled={items.length === 0} /></View>
        </View>
      </View>
    </Modal>
  );
}

function GameModal({ visible, onClose, sessionId, onDone, bottom }: any) {
  const { colors } = useTheme();
  const games = useQuery({ queryKey: ["games"], queryFn: () => api.get<Game[]>("/games"), enabled: visible });
  const pick = async (gid: string) => { await api.post(`/sessions/${sessionId}/change-game`, { game_id: gid }); onClose(); onDone(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: bottom + 20, maxHeight: "70%" }}>
          <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Change Game</Text>
          <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(games.data || []).map((g) => <Chip key={g.id} label={g.name} onPress={() => pick(g.id)} testID={`pick-game-${g.name}`} />)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
