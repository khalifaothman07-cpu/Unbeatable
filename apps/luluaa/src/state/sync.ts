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

/* A snapshot plus the server revision it was read at. Revisions, not
   timestamps, decide which of two writes wins: clocks on two phones
   disagree, and "whichever request happened to arrive last" is how a move
   silently disappears. */
export interface Room { snapshot: Snapshot; rev: number; claims: Claims }

/** seat index (as a string key) -> taken. Server-owned; clients never push it. */
export type Claims = Record<string, boolean>;

export type PushResult = "ok" | "stale" | "error";

const TABLE = "luluaa_games";

export async function createRoom(code: string, snap: Snapshot): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  const { error } = await c.from(TABLE)
    .upsert({ room_code: code, snapshot: snap, rev: 1 }, { onConflict: "room_code" });
  if (error) console.warn("[sync] createRoom failed:", error.message);
  return !error;
}

/** Advance the room to `rev`. Rejected as "stale" if someone got there first. */
export async function pushSnapshot(code: string, snap: Snapshot, rev: number): Promise<PushResult> {
  const c = getClient();
  if (!c) return "error";
  const { data, error } = await c.from(TABLE)
    .update({ snapshot: snap, rev })
    .eq("room_code", code)
    .lt("rev", rev)
    .select("rev");
  if (error) { console.warn("[sync] push failed:", error.message); return "error"; }
  /* no rows updated means the stored revision was already >= ours: another
     device has since moved, and this snapshot describes a table that no
     longer exists. The caller re-reads rather than insisting. */
  return data && data.length ? "ok" : "stale";
}

export async function fetchRoom(code: string): Promise<Room | null> {
  const c = getClient();
  if (!c) return null;
  const { data, error } = await c.from(TABLE).select("snapshot, rev, claims").eq("room_code", code).maybeSingle();
  if (error || !data) return null;
  return {
    snapshot: data.snapshot as Snapshot,
    rev: (data.rev as number) ?? 0,
    claims: (data.claims as Claims) ?? {},
  };
}

/** Take a seat. Atomic in the database; null means the seat was already gone. */
export async function claimSeat(code: string, seat: number): Promise<Claims | null> {
  const c = getClient();
  if (!c) return null;
  const { data, error } = await c.rpc("luluaa_claim_seat", { p_code: code, p_seat: seat });
  if (error) { console.warn("[sync] claim failed:", error.message); return null; }
  return (data as Claims | null) ?? null;
}

export type LinkStatus = "connecting" | "live" | "error";

/** Subscribe to a room; returns an unsubscribe. */
export function subscribeRoom(
  code: string,
  onSnap: (r: Room) => void,
  onStatus?: (st: LinkStatus) => void,
): () => void {
  const c = getClient();
  if (!c) { onStatus?.("error"); return () => {}; }
  onStatus?.("connecting");
  const ch: RealtimeChannel = c
    .channel(`room:${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `room_code=eq.${code}` },
      (payload) => {
        const row = payload.new as { snapshot?: Snapshot; rev?: number; claims?: Claims } | null;
        if (row?.snapshot) onSnap({ snapshot: row.snapshot, rev: row.rev ?? 0, claims: row.claims ?? {} });
      }
    )
    .subscribe((status) => {
      /* SUBSCRIBED is the only state where changes actually arrive; the rest
         mean the far side's moves will not reach this device, which the
         player needs to see rather than discover by being ignored. */
      if (status === "SUBSCRIBED") onStatus?.("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus?.("error");
    });
  return () => { void c.removeChannel(ch); };
}

/* A joined device polls as a safety net: Realtime is the fast path, but a
   phone that sleeps, changes wifi, or drops off the network can miss the
   push that would have woken it. Polling is slow and cheap and means a
   stalled table always recovers instead of needing a reload. */
export function pollRoom(code: string, onSnap: (r: Room) => void, everyMs = 4000): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    const room = await fetchRoom(code);
    if (!stopped && room) onSnap(room);
  };
  const h = setInterval(() => void tick(), everyMs);
  return () => { stopped = true; clearInterval(h); };
}
