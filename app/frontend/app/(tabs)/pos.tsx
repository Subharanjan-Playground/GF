import { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api";
import { useTheme } from "@/src/theme";
import { useShops, Product } from "@/src/hooks";
import { inr } from "@/src/format";
import { Chip, Loading, EmptyState, ScreenHeader, PrimaryButton, Ionicons } from "@/src/ui";

export default function POS() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: shops = [] } = useShops();
  const [shopId, setShopId] = useState<string | null>(null);
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pickSession, setPickSession] = useState(false);
  const [toast, setToast] = useState("");

  const activeShop = shopId || shops[0]?.id;
  const products = useQuery({ queryKey: ["products", activeShop], queryFn: () => api.get<Product[]>(`/products?shop_id=${activeShop}`), enabled: !!activeShop });
  const sessions = useQuery({ queryKey: ["active-sessions", activeShop], queryFn: () => api.get<any[]>(`/sessions?status=active&shop_id=${activeShop}`), enabled: pickSession });

  const cats = ["All", ...Array.from(new Set((products.data || []).map((p) => p.category)))];
  const list = (products.data || []).filter((p) => cat === "All" || p.category === cat);
  const items = Object.entries(cart).filter(([, q]) => q > 0);
  const total = items.reduce((s, [id, q]) => s + (products.data?.find((p) => p.id === id)?.selling_price || 0) * q, 0);
  const count = items.reduce((s, [, q]) => s + q, 0);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const rm = (id: string) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) - 1) }));

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const checkout = async (sessionId?: string) => {
    const payload = { shop_id: activeShop, items: items.map(([product_id, qty]) => ({ product_id, qty })), payment_method: "cash", session_id: sessionId };
    await api.post("/pos/checkout", payload);
    setCart({});
    setPickSession(false);
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["stations"] });
    flash(sessionId ? "Added to gaming session" : "Payment complete");
  };

  const bottom = insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
        <ScreenHeader title="POS / Snacks" subtitle="Food & beverage counter" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          {shops.map((s) => <Chip key={s.id} label={s.code} active={activeShop === s.id} onPress={() => setShopId(s.id)} testID={`pos-shop-${s.code}`} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 10 }}>
          {cats.map((c) => <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} testID={`pos-cat-${c}`} />)}
        </ScrollView>
      </View>

      {products.isLoading ? <Loading testID="pos-loading" /> : list.length === 0 ? <EmptyState icon="fast-food-outline" text="No items in this category" testID="pos-empty" /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottom + (count ? 150 : 40) }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {list.map((p) => {
              const inCart = cart[p.id] || 0;
              const low = p.current_stock <= p.minimum_stock;
              return (
                <View key={p.id} testID={`product-${p.name}`} style={{ width: "47.5%", backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 14, flex: 1 }}>{p.name}</Text>
                  </View>
                  <Text style={{ color: colors.brandPrimary, fontSize: 18, fontWeight: "600", marginTop: 6 }}>{inr(p.selling_price)}</Text>
                  <Text style={{ color: low ? colors.warning : colors.muted, fontSize: 11, margintop: 2 }}>Stock: {p.current_stock}</Text>
                  {inCart > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                      <Pressable testID={`product-minus-${p.name}`} onPress={() => rm(p.id)} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={18} color={colors.onSurface} /></Pressable>
                      <Text style={{ color: colors.onSurface, fontSize: 16 }}>{inCart}</Text>
                      <Pressable testID={`product-plus-${p.name}`} onPress={() => add(p.id)} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={18} color={colors.onBrandPrimary} /></Pressable>
                    </View>
                  ) : (
                    <Pressable testID={`product-add-${p.name}`} onPress={() => add(p.id)} style={{ marginTop: 10, backgroundColor: colors.surfaceTertiary, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}>
                      <Text style={{ color: colors.brandPrimary, fontSize: 13 }}>Add</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {count > 0 ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border, padding: 16, paddingBottom: bottom + 16, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>{count} items</Text>
            <Text testID="cart-total" style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600" }}>{inr(total)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><PrimaryButton testID="pos-pay-now" title="Pay Now" onPress={() => checkout()} icon="card-outline" /></View>
            <Pressable testID="pos-add-session" onPress={() => setPickSession(true)} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
              <Ionicons name="game-controller-outline" size={18} color={colors.brandPrimary} />
              <Text style={{ color: colors.brandPrimary, fontSize: 15, fontWeight: "600" }}>To Session</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {toast ? (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: bottom + (count ? 170 : 24), backgroundColor: colors.surfaceInverse, borderRadius: 12, padding: 14 }}>
          <Text testID="pos-toast" style={{ color: colors.onSurfaceInverse, textAlign: "center" }}>{toast}</Text>
        </View>
      ) : null}

      <Modal visible={pickSession} transparent animationType="slide" onRequestClose={() => setPickSession(false)}>
        <Pressable onPress={() => setPickSession(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: bottom + 20, maxHeight: "70%" }}>
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Attach to active session</Text>
            {sessions.isLoading ? <Loading /> : (sessions.data || []).length === 0 ? <EmptyState icon="pulse-outline" text="No active sessions" /> : (
              <ScrollView>
                {(sessions.data || []).map((s) => (
                  <Pressable key={s.id} testID={`attach-session-${s.station_name}`} onPress={() => checkout(s.id)} style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceTertiary, marginBottom: 8 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15 }}>{s.station_name} · {s.customer_name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{s.game_name || "No game"} · {inr(s.total)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
