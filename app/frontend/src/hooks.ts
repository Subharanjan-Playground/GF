import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api";

export type Shop = { id: string; name: string; code: string; city?: string };
export type Station = {
  id: string; shop_id: string; name: string; type: string; hourly_rate: number;
  description?: string; status: string; active_session?: any; current_customer?: string; current_game?: string; next_booking?: any;
};
export type Game = { id: string; name: string; platform: string; genre?: string; active: boolean };
export type Product = { id: string; name: string; category: string; selling_price: number; purchase_price: number; current_stock: number; minimum_stock: number; shop_id: string };
export type Customer = { id: string; name: string; phone: string; email?: string; total_sessions: number; total_spent: number; last_visit?: string | null; sessions?: any[] };
export type Session = any;
export type Booking = any;

export function useShops() {
  return useQuery({ queryKey: ["shops"], queryFn: () => api.get<Shop[]>("/shops") });
}
