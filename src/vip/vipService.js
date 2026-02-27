function createVipService({ store, logger, configManager }) {
  let state = { vips: {}, settings: {}, guilds: {} };

  async function init() {
    state = await store.load();
    if (!state.settings || typeof state.settings !== "object") state.settings = {};
    if (!state.guilds || typeof state.guilds !== "object") state.guilds = {};
    logger?.info?.({ count: Object.keys(state.vips).length }, "VIP carregado");
  }

  function normalizeUserId(userId) {
    if (typeof userId !== "string") return null;
    const v = String(userId).trim();
    return v || null;
  }

  function getGuildConfig(guildId) {
    if (!guildId) return null;
    return state.guilds[guildId] || null;
  }

  async function setGuildConfig(guildId, patch) {
    if (!guildId) throw new Error("guildId inválido");
    const existing = state.guilds[guildId] || {};
    state.guilds[guildId] = { ...existing, ...patch };
    await store.save(state);
    return state.guilds[guildId];
  }

  function isVipByRole(member) {
    if (!member?.guild?.id) return false;
    const config = getGuildConfig(member.guild.id);
    const roleId = config?.vipRoleId;
    if (!roleId || !member?.roles?.cache) return false;
    return member.roles.cache.has(roleId);
  }

  function isVip({ userId, member } = {}) {
    const id = normalizeUserId(userId) || normalizeUserId(member?.user?.id);
    if (!id) return false;
    if (member && isVipByRole(member)) return true;
    return Boolean(state.vips[id]);
  }

  async function addVip(userId, { days, tierId } = {}) {
    const id = normalizeUserId(userId);
    if (!id) throw new Error("userId inválido");

    const now = Date.now();
    const existing = state.vips[id];
    let expiresAt = null;
    if (days && days > 0) {
      const base = existing?.expiresAt > now ? existing.expiresAt : now;
      expiresAt = base + days * 24 * 60 * 60 * 1000;
    }

    state.vips[id] = {
      userId: id,
      addedAt: existing?.addedAt ?? now,
      expiresAt: expiresAt || existing?.expiresAt || null,
      tierId: tierId ?? existing?.tierId ?? null,
    };
    await store.save(state);
    return { created: !existing, vip: state.vips[id] };
  }

  async function removeVip(userId) {
    const id = normalizeUserId(userId);
    if (!id) throw new Error("userId inválido");
    const existing = state.vips[id];
    if (!existing) return { removed: false };
    delete state.vips[id];
    await store.save(state);
    return { removed: true, vip: existing };
  }

  function listVipIds() {
    return Object.keys(state.vips);
  }

  function getVip(userId) {
    const id = normalizeUserId(userId);
    return id ? (state.vips[id] || null) : null;
  }

  function getSettings(userId) {
    const id = normalizeUserId(userId);
    return id ? (state.settings[id] || null) : null;
  }

  async function setSettings(userId, patch) {
    const id = normalizeUserId(userId);
    if (!id) throw new Error("userId inválido");
    if (!patch || typeof patch !== "object") throw new Error("patch inválido");
    const existing = state.settings[id] || {};
    state.settings[id] = { ...existing, ...patch, userId: id };
    await store.save(state);
    return state.settings[id];
  }

  function getDamasCount(userId) {
    const id = normalizeUserId(userId);
    if (!id) return 0;
    const damas = state.settings[id]?.damas;
    return Array.isArray(damas) ? damas.length : 0;
  }

  function getDamas(userId) {
    const id = normalizeUserId(userId);
    if (!id) return [];
    const damas = state.settings[id]?.damas;
    return Array.isArray(damas) ? [...damas] : [];
  }

  async function addDama(donoId, damaId) {
    const id = normalizeUserId(donoId);
    if (!id || !damaId) throw new Error("donoId e damaId obrigatórios");
    const settings = state.settings[id] || {};
    const lista = Array.isArray(settings.damas) ? settings.damas : [];
    if (lista.includes(damaId)) return;
    state.settings[id] = { ...settings, userId: id, damas: [...lista, damaId] };
    await store.save(state);
  }

  async function removeDama(donoId, damaId) {
    const id = normalizeUserId(donoId);
    if (!id) throw new Error("donoId inválido");
    const settings = state.settings[id] || {};
    let lista = Array.isArray(settings.damas) ? settings.damas : [];
    if (damaId) lista = lista.filter((x) => x !== damaId);
    else lista = [];
    state.settings[id] = { ...settings, userId: id, damas: lista };
    await store.save(state);
  }

  async function getTierConfig(guildId, tierId) {
    if (!configManager) return null;
    return configManager.getTierConfig(guildId, tierId);
  }

  async function updateTier(guildId, tierId, config) {
    if (!configManager) throw new Error("configManager não injetado");
    await configManager.setGuildTier(guildId, tierId, {
      name: config.name,
      price: config.price,
      roleId: config.roleId,
      days: config.days,
      maxDamas: config.maxDamas,
      canFamily: config.canFamily,
      hasSecondRole: config.hasSecondRole,
      maxSecondRoleMembers: config.maxSecondRoleMembers,
      maxFamilyMembers: config.maxFamilyMembers,
    });
  }

  async function resetGuildConfig(guildId) {
    if (!guildId) throw new Error("guildId inválido");
    state.guilds[guildId] = {};
    await store.save(state);
    return state.guilds[guildId];
  }

  async function resetAll() {
    state = { vips: {}, settings: {}, guilds: {} };
    await store.save(state);
    return true;
  }

  function listSettingsUserIds() {
    return Object.keys(state.settings || {});
  }

  return {
    init,
    isVip,
    addVip,
    removeVip,
    listVipIds,
    getVip,
    getSettings,
    setSettings,
    getGuildConfig,
    setGuildConfig,
    getDamasCount,
    getDamas,
    addDama,
    removeDama,
    getTierConfig,
    updateTier,
    resetGuildConfig,
    resetAll,
    listSettingsUserIds,
  };
}

module.exports = { createVipService };
