import React, { useEffect, useMemo, useState } from "react";

// Simple, shareable single-file React app for managing dishwasher loads
// NEW: Per-roommate numeric PINs required to claim "I ran" / "I unloaded" actions.
// Features
// - Rotation by LOAD (not day) with a visible queue
// - Two daily anchor windows: 3 PM Load, Night Load (9–11 PM)
// - Brunch Buffer (11:00–14:00) reminder to avoid running mid-brunch
// - Flex Rule: anyone can run/unload for someone else; credits go to who actually did it
// - Credits: 0.5 credit for a run, 0.5 credit for an unload (fair split)
// - Pause/Skip a roommate temporarily
// - Local storage persistence
// - NEW: PIN management UI + PIN verification on run/unload
//
// Deploy ideas: drop this into a Vite/Next.js project and host on Netlify/Vercel/GitHub Pages.

const STORAGE_KEY = "dishwasher_app_state_v2_pins";

function useLocalStorageState(defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);
  return [state, setState];
}

const defaultState = {
  roommates: ["A", "B", "C", "D"],
  queue: ["A", "B", "C", "D"], // rotation by load
  paused: {}, // { name: true }
  credits: {}, // { name: number }
  history: [], // { id, when, kind: '3pm'|'night', runBy, unloadBy, runCredit, unloadCredit }
  pins: {}, // { name: "1234" }
};

const Label = ({ children }) => (
  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100">
    {children}
  </span>
);

function Section({ title, children, extra }) {
  return (
    <div className="rounded-2xl shadow-sm border p-4 bg-white">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function DishwasherApp() {
  const [state, setState] = useLocalStorageState(defaultState);
  const { roommates, queue, paused, credits, history, pins } = state;

  const activeQueue = useMemo(
    () => queue.filter((n) => !paused[n]),
    [queue, paused]
  );

  // Ensure credits & pins exist for all roommates
  useEffect(() => {
    const updatedCredits = { ...credits };
    const updatedPins = { ...pins };
    roommates.forEach((r) => {
      if (updatedCredits[r] == null) updatedCredits[r] = 0;
      if (updatedPins[r] == null) updatedPins[r] = ""; // empty means no PIN set yet
    });
    if (
      JSON.stringify(updatedCredits) !== JSON.stringify(credits) ||
      JSON.stringify(updatedPins) !== JSON.stringify(pins)
    ) {
      setState((s) => ({ ...s, credits: updatedCredits, pins: updatedPins }));
    }
  }, [roommates]);

  const current = activeQueue[0] || null;
  const next = activeQueue[1] || null;

  function setRoommatesFromInput(value) {
    const list = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!list.length) return;
    setState((s) => ({
      ...s,
      roommates: list,
      queue: list.filter((n) => !s.paused[n]),
      credits: list.reduce((acc, n) => ({ ...acc, [n]: s.credits[n] ?? 0 }), {}),
      pins: list.reduce((acc, n) => ({ ...acc, [n]: s.pins[n] ?? "" }), {}),
    }));
  }

  function reorderQueue(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const active = [...activeQueue];
    const [moved] = active.splice(fromIdx, 1);
    active.splice(toIdx, 0, moved);
    const pausedList = state.queue.filter((n) => paused[n]);
    setState((s) => ({ ...s, queue: active.concat(pausedList) }));
  }

  function advanceQueue() {
    if (!activeQueue.length) return;
    const rotated = [...activeQueue.slice(1), activeQueue[0]];
    const full = rotated.concat(state.queue.filter((n) => paused[n]));
    setState((s) => ({ ...s, queue: full }));
  }

  function togglePause(name) {
    setState((s) => {
      const p = { ...s.paused, [name]: !s.paused[name] };
      const active = s.queue.filter((n) => !p[n]);
      const pausedList = s.queue.filter((n) => p[n]);
      return { ...s, paused: p, queue: active.concat(pausedList) };
    });
  }

  function setPin(name, pinRaw) {
    const pin = (pinRaw || "").trim();
    if (pin && !/^[0-9]{4,8}$/.test(pin)) {
      alert("PIN must be 4–8 digits.");
      return;
    }
    setState((s) => ({ ...s, pins: { ...s.pins, [name]: pin } }));
  }

  function requirePinFor(name) {
    const expected = (pins[name] || "").trim();
    if (!expected) return true; // no PIN set → allow
    const entered = prompt(`Enter PIN for ${name}`)?.trim();
    if (entered === expected) return true;
    alert("Incorrect PIN.");
    return false;
    }

  function addCredits({ runBy, unloadBy, kind }) {
    setState((s) => {
      const c = { ...s.credits };
      if (runBy) c[runBy] = (c[runBy] ?? 0) + 0.5;
      if (unloadBy) c[unloadBy] = (c[unloadBy] ?? 0) + 0.5;
      const entry = {
        id: Math.random().toString(36).slice(2),
        when: new Date().toISOString(),
        kind,
        runBy,
        unloadBy,
        runCredit: 0.5,
        unloadCredit: 0.5,
      };
      return { ...s, credits: c, history: [entry, ...s.history].slice(0, 200) };
    });
  }

  function completeLoad(kind, { runBy, unloadBy, advance = true }) {
    addCredits({ runBy, unloadBy, kind });
    if (advance) advanceQueue();
  }

  function handleComplete(kind) {
    // Ask who ran / unloaded (Flex Rule), then verify PINs for those names
    const defaultName = current ?? roommates[0] ?? "";
    const runBy = prompt(
      `${kind === "3pm" ? "3 PM" : "Night"} LOAD
Who RAN it? (default: ${defaultName})
Type a name exactly or leave blank`
    )?.trim() || defaultName;

    if (!runBy) return alert("Please set roommates first.");
    if (!requirePinFor(runBy)) return; // PIN check for runner

    const unloadBy = (
      prompt(
        `${kind === "3pm" ? "3 PM" : "Night"} LOAD
Who UNLOADED it? (default: ${runBy})
Type a name exactly or leave blank`
      )?.trim() || runBy
    );

    if (!unloadBy) return alert("Please set roommates first.");
    if (!requirePinFor(unloadBy)) return; // PIN check for unloader

    completeLoad(kind, { runBy, unloadBy, advance: true });
  }

  function quickClaim(kind, name, action) {
    // action: 'run' | 'unload' — lets a roommate click their own button
    if (!requirePinFor(name)) return;
    if (action === 'run') {
      completeLoad(kind, { runBy: name, unloadBy: name, advance: true });
    } else if (action === 'unload') {
      const runner = current || name;
      completeLoad(kind, { runBy: runner, unloadBy: name, advance: true });
    }
  }

  function resetCredits() {
    if (!confirm("Reset all credits to 0?")) return;
    setState((s) => ({ ...s, credits: Object.fromEntries(Object.keys(s.credits).map((k) => [k, 0])) }));
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Dishwasher Rotation • By Load</h1>
          <Label>Brunch Buffer: 11:00–14:00 • Night: 21:00–23:00 • PINs enabled</Label>
        </header>

        <Section title="House Rules (Quick Ref)">
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Everyone rinses their own dishes. Dishwasher-safe items go in immediately.</li>
            <li>Hand-wash lane: big pots/pans, knives, wooden tools, non-safe plastics.</li>
            <li>Rotation is by <b>load</b>. Flex Rule: you can run/unload for someone else; credits go to who actually did it.</li>
            <li>Night load must be <b>run & unloaded before bed</b> so mornings start empty.</li>
            <li>Don’t run during Brunch Buffer (11–14). Aim for a 15:00 load, and a 21:00–23:00 load.</li>
            <li><b>PINs:</b> Each roommate sets a numeric PIN (4–8 digits). You must enter your PIN to claim "I ran" or "I unloaded".</li>
          </ul>
        </Section>

        <Section title="Roommates & Rotation">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium">Names (comma-separated)</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                defaultValue={roommates.join(", ")}
                onBlur={(e) => setRoommatesFromInput(e.target.value)}
                placeholder="e.g., Alex, Brooke, Casey, Dev"
              />
              <div className="text-xs text-gray-500">Tip: Reorder queue with ↑ / ↓. Pause if someone is away.</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeQueue.map((name, idx) => (
                  <div key={name} className={`px-3 py-1 rounded-full text-sm border shadow-sm ${idx===0?"bg-black text-white":"bg-white"}`}>
                    <div className="flex items-center gap-2">
                      <span>{idx+1}. {name}</span>
                      <button className="text-xs underline" onClick={() => togglePause(name)}>
                        {paused[name] ? "Unpause" : "Pause"}
                      </button>
                      <div className="flex items-center gap-1">
                        <button className="text-xs" onClick={() => reorderQueue(idx, Math.max(0, idx-1))}>↑</button>
                        <button className="text-xs" onClick={() => reorderQueue(idx, Math.min(activeQueue.length-1, idx+1))}>↓</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium mb-1">Quick Claim (with PIN)</div>
              <div className="grid grid-cols-2 gap-2">
                {roommates.map((name) => (
                  <div key={name} className="rounded-xl border p-3 bg-white">
                    <div className="font-medium text-sm mb-2">{name}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button className="px-2 py-1 rounded-lg border" onClick={() => quickClaim('3pm', name, 'run')}>I ran 3 PM</button>
                      <button className="px-2 py-1 rounded-lg border" onClick={() => quickClaim('3pm', name, 'unload')}>I unloaded 3 PM</button>
                      <button className="px-2 py-1 rounded-lg border" onClick={() => quickClaim('night', name, 'run')}>I ran Night</button>
                      <button className="px-2 py-1 rounded-lg border" onClick={() => quickClaim('night', name, 'unload')}>I unloaded Night</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="PINs (4–8 digits)">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {roommates.map((n) => (
              <div key={n} className="rounded-xl border p-3 bg-white">
                <div className="text-sm font-medium mb-1">{n}</div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={pins[n] ? "••••" : "Set PIN"}
                    onBlur={(e) => setPin(n, e.target.value)}
                  />
                  <button className="text-xs underline" onClick={() => setPin(n, "")}>Clear</button>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">PIN is stored locally on this device.</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Run / Unload Loads">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold">3 PM Load</h3><Label>Run after 14:00</Label></div>
              <p className="text-sm text-gray-600">Default runner: <b>{current ?? "—"}</b>{next?` • Next: ${next}`:""}</p>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={() => handleComplete("3pm")}>Record 3 PM (choose runners)</button>
              </div>
              <p className="text-xs text-gray-500">Flex Rule: If you filled it or someone texted they can’t make it, you may run/unload on their behalf. Credits split to the actual people (PINs required).</p>
            </div>
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold">Night Load</h3><Label>21:00–23:00 • Unload before bed</Label></div>
              <p className="text-sm text-gray-600">Default runner: <b>{current ?? "—"}</b>{next?` • Next: ${next}`:""}</p>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={() => handleComplete("night")}>Record Night (choose runners)</button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Credits & Balancing" extra={<button className="text-sm underline" onClick={resetCredits}>Reset credits</button>}>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {roommates.map((n) => (
              <div key={n} className="rounded-xl border p-3 bg-white">
                <div className="text-sm font-medium mb-1">{n}</div>
                <div className="text-2xl font-bold">{(credits[n] ?? 0).toFixed(1)}</div>
                <div className="text-xs text-gray-500">Target: keep everyone within ±2 over a month.</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="History (latest 20)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">When</th>
                  <th className="py-2 pr-2">Kind</th>
                  <th className="py-2 pr-2">Ran By</th>
                  <th className="py-2 pr-2">Unloaded By</th>
                  <th className="py-2 pr-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0,20).map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap">{new Date(h.when).toLocaleString()}</td>
                    <td className="py-2 pr-2">{h.kind === '3pm' ? '3 PM' : 'Night'}</td>
                    <td className="py-2 pr-2">{h.runBy}</td>
                    <td className="py-2 pr-2">{h.unloadBy}</td>
                    <td className="py-2 pr-2">+{h.runCredit}+{h.unloadCredit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <footer className="text-xs text-gray-500 text-center pb-6">
          Tip: Host on Netlify/Vercel/GitHub Pages. Data (including PINs) is saved <b>locally on this device</b>. For cross-device sync, wire up Supabase/Firebase.
        </footer>
      </div>
    </div>
  );
}
