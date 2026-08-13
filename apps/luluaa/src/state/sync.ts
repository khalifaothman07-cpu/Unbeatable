/* =========================================================================
   sync.ts — remote seats over Supabase Realtime
   -------------------------------------------------------------------------
   LAZY BY DESIGN (spec §9.4): nothing here runs while every seat is local.
   The client is only created, and the row only written, once a table gains
   its first remote seat. A fully local game therefore has no network
   dependency at all and works with Supabase unreachable.

   What travels is a SNAPSHOT, not the derived world: the board seed plus
   the mutable state. Geometry and tiles are rebuilt from the seed on the
   far side, so a reconnect reproduces an identical board (spec §2) without
   shipping 30 tiles and several hundred vertices over the wire.
   ========================================================================= */

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const remoteConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!remoteConfigured) return null;
  if (!client) client = createClient(URL!, KEY!, { realtime: { params: { eventsPerSecond: 5 } } });
  return client;
}

/* Room codes: no 0/O/1/I, so a code read aloud or over a call can't be
   mistyped into someone else's table. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeRoomCode(len = 5): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

export interface Snapshot {
  v: number;
  seed: string;
  rows: number[];
  state: unknown; // the serialisable slice of the game
  updatedAt: string;
}

const TABLE = "luluaa_games";

export async function createRoom(code: string, snap: Snapshot): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  const { error } = await c.from(TABLE).upsert({ room_code: code, snapshot: snap }, { onConflict: "room_code" });
  if (error) console.warn("[sync] createRoom failed:", error.message);
  return !error;
}

export async function pushSnapshot(code: string, snap: Snapshot): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  const { error } = await c.from(TABLE).update({ snapshot: snap }).eq("room_code", code);
  if (error) console.warn("[sync] push failed:", error.message);
  return !error;
}

export async function fetchSnapshot(code: string): Promise<Snapshot | null> {
  const c = getClient();
  if (!c) return null;
  const { data, error } = await c.from(TABLE).select("snapshot").eq("room_code", code).maybeSingle();
  if (error || !data) return null;
  return data.snapshot as Snapshot;
}

/** Subscribe to a room; returns an unsubscribe. */
export function subscribeRoom(code: string, onSnap: (s: Snapshot) => void): () => void {
  const c = getClient();
  if (!c) return () => {};
  const ch: RealtimeChannel = c
    .channel(`room:${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `room_code=eq.${code}` },
      (payload) => {
        const row = payload.new as { snapshot?: Snapshot } | null;
        if (row?.snapshot) onSnap(row.snapshot);
      }
    )
    .subscribe();
  return () => { void c.removeChannel(ch); };
}
