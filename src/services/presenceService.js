const { createDataStore } = require("../store/dataStore");

function createPresenceService() {
  const store = createDataStore("presence.json");

  async function getPresence() {
    const data = await store.get("presence");
    if (!data || typeof data !== "object") return null;
    return data;
  }

  async function setPresence(patch) {
    if (!patch || typeof patch !== "object") throw new Error("patch inválido");
    const current = (await getPresence()) || {};
    const next = { ...current, ...patch };
    await store.set("presence", next);
    return next;
  }

  async function clearPresence() {
    await store.set("presence", null);
    return true;
  }

  async function applyPresence(client) {
    if (!client?.user) return { ok: false, reason: "client_unavailable" };
    const saved = await getPresence();
    if (!saved) return { ok: false, reason: "no_presence_saved" };

    const status = saved.status;
    const activity = saved.activity;

    const activities = [];
    if (activity?.name) {
      const entry = {
        name: String(activity.name),
      };
      if (typeof activity.type === "number") entry.type = activity.type;
      if (activity.url) entry.url = String(activity.url);
      activities.push(entry);
    }

    await client.user
      .setPresence({
        status: status || undefined,
        activities,
      })
      .catch(() => {});

    return { ok: true };
  }

  return { getPresence, setPresence, clearPresence, applyPresence };
}

module.exports = { createPresenceService };
