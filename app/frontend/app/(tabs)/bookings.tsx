import { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme } from "@/src/theme";
import { useShops, Station, Customer, Game } from "@/src/hooks";
import { inr } from "@/src/format";
import { Chip, Loading, EmptyState, ScreenHeader, PrimaryButton, Ionicons } from "@/src/ui";

const STATUS_COLORS: Record<string, string> = { confirmed: "#F59E0B", pending: "#64748B", checked_in: "#10B981", cancelled: "#EF4444", completed: "#06B6D4" };

export default function Bookings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: shops = [] } = useShops();
  const [shopId, setShopId] = useState("all");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const bookings = useQuery({ queryKey: ["bookings", shopId], queryFn: () => api.get<any[]>(`/bookings?shop_id=${shopId}`) });

  // create form
  const activeShop = shopId !== "all" ? shopId : shops[0]?.id;
  const [fShop, setFShop] = useState<string>("");
  const stations = useQuery({ queryKey: ["stations", fShop || activeShop], queryFn: () => api.get<Station[]>(`/stations?shop_id=${fShop || activeShop}`), enabled: open });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => api.get<Customer[]>("/customers"), enabled: open });
  const games = useQuery({ queryKey: ["games"], queryFn: () => api.get<Game[]>("/games"), enabled: open });
  const [stationId, setStationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [gameId, setGameId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("20:00");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!stationId || !customerId) { setErr("Select a station and customer"); return; }
    setBusy(true);
    try {
      await api.post("/bookings", { shop_id: fShop || activeShop, station_id: stationId, customer_id: customerId, game_id: gameId || null, date, start_time: start, end_time: end });
      setOpen(false); setStationId(""); setCustomerId(""); setGameId("");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const action = async (id: string, kind: "checkin" | "cancel") => {
    await api.post(`/bookings/${id}/${kind}`);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["stations"] });
  };

  const bottom = insets.bottom;
  const inputStyle = { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, flex: 1 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
        <ScreenHeader title="Bookings" subtitle="Advance slot reservations" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          <Chip label="All Shops" active={shopId === "all"} onPress={() => setShopId("all")} testID="bk-shop-all" />
          {shops.map((s) => <Chip key={s.id} label={s.code} active={shopId === s.id} onPress={() => setShopId(s.id)} testID={`bk-shop-${s.code}`} />)}
        </ScrollView>
      </View>

      {bookings.isLoading ? <Loading testID="bookings-loading" /> : (bookings.data || []).length === 0 ? (
        <EmptyState icon="calendar-outline" text="No bookings yet. Tap + to create one." testID="bookings-empty" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottom + 90 }}>
          {(bookings.data || []).map((b) => (
            <View key={b.id} testID={`booking-${b.ref}`} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }}>{b.station_name} · {b.customer_name}</Text>
                <View style={{ backgroundColor: (STATUS_COLORS[b.status] || colors.muted) + "33", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ color: STATUS_COLORS[b.status] || colors.muted, fontSize: 11 }}>{b.status.replace("_", " ").toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{b.ref}</Text>
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 6 }}>{b.date} · {b.start_time}–{b.end_time} · {b.game_name || "No game"}</Text>
              <Text style={{ color: colors.brandPrimary, fontSize: 15, marginTop: 6 }}>{inr(b.amount)}</Text>
              {b.status === "confirmed" ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable testID={`booking-checkin-${b.ref}`} onPress={() => action(b.id, "checkin")} style={{ flex: 1, backgroundColor: colors.brandPrimary, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: colors.onBrandPrimary, fontSize: 13, fontWeight: "600" }}>Check-in</Text>
                  </Pressable>
                  <Pressable testID={`booking-cancel-${b.ref}`} onPress={() => action(b.id, "cancel")} style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: colors.error, fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      <Pressable testID="add-booking-fab" onPress={() => { setFShop(activeShop || ""); setOpen(true); }} style={{ position: "absolute", right: 16, bottom: bottom + 16, backgroundColor: colors.brandPrimary, borderRadius: 999, width: 56, height: 56, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: bottom + 20, maxHeight: "88%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600" }}>New Booking</Text>
              <Pressable testID="close-booking-modal" onPress={() => setOpen(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
            </View>
            <ScrollView>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>SHOP</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                {shops.map((s) => <Chip key={s.id} label={s.code} active={(fShop || activeShop) === s.id} onPress={() => { setFShop(s.id); setStationId(""); }} testID={`bkf-shop-${s.code}`} />)}
              </ScrollView>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>STATION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                {(stations.data || []).map((s) => <Chip key={s.id} label={s.name} active={stationId === s.id} onPress={() => setStationId(s.id)} testID={`bkf-station-${s.name}`} />)}
              </ScrollView>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>CUSTOMER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                {(customers.data || []).map((c) => <Chip key={c.id} label={c.name} active={customerId === c.id} onPress={() => setCustomerId(c.id)} testID={`bkf-cust-${c.name}`} />)}
              </ScrollView>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>GAME (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                {(games.data || []).map((g) => <Chip key={g.id} label={g.name} active={gameId === g.id} onPress={() => setGameId(gameId === g.id ? "" : g.id)} testID={`bkf-game-${g.name}`} />)}
              </ScrollView>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>DATE / TIME</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <TextInput testID="bkf-date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={inputStyle} />
                <TextInput testID="bkf-start" value={start} onChangeText={setStart} placeholder="HH:MM" placeholderTextColor={colors.muted} style={inputStyle} />
                <TextInput testID="bkf-end" value={end} onChangeText={setEnd} placeholder="HH:MM" placeholderTextColor={colors.muted} style={inputStyle} />
              </View>
              {err ? <Text testID="bkf-error" style={{ color: colors.error, fontSize: 13, marginBottom: 10 }}>{err}</Text> : null}
              <PrimaryButton testID="bkf-submit" title="Confirm Booking" onPress={submit} loading={busy} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
