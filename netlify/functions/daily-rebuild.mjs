/* =========================================================================
   daily-rebuild.mjs — Netlify Scheduled Function
   -------------------------------------------------------------------------
   Netlify only rebuilds on push, so without this the baked-in FX rates
   would freeze at whatever the last commit produced. This fires once a
   day and pokes a build hook, which reruns scripts/fetch-live.mjs and
   republishes with fresh rates.

   MANUAL SETUP (one time, in the Netlify UI):
     1. Site configuration → Build & deploy → Build hooks → Add build hook
     2. Copy the generated URL
     3. Site configuration → Environment variables → add BUILD_HOOK_URL
   Until that variable exists this function is a no-op — it logs and
   returns, so a missing hook can't look like a successful refresh.

   The hook URL is a secret: anyone holding it can trigger builds. It
   lives in an env var, never in the repo.
   ========================================================================= */

export default async function handler() {
  const hook = process.env.BUILD_HOOK_URL;

  if (!hook) {
    console.warn("[daily-rebuild] BUILD_HOOK_URL is not set — no rebuild triggered.");
    console.warn("[daily-rebuild] Create a build hook in the Netlify UI and add it as an env var.");
    return new Response("BUILD_HOOK_URL not configured", { status: 200 });
  }

  try {
    const res = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[daily-rebuild] build hook returned HTTP ${res.status}`);
      return new Response(`build hook failed: ${res.status}`, { status: 500 });
    }
    console.log("[daily-rebuild] build triggered");
    return new Response("build triggered", { status: 200 });
  } catch (err) {
    console.error(`[daily-rebuild] could not reach build hook: ${err.message}`);
    return new Response(`error: ${err.message}`, { status: 500 });
  }
}

/* 04:00 UTC — after the upstream feed's ~00:02 UTC daily refresh, and
   outside Gulf browsing hours (07:00 Bahrain) so a deploy never lands
   mid-visit. */
export const config = { schedule: "0 4 * * *" };
