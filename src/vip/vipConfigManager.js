const { createDataStore } = require("../store/dataStore");

const vipConfigStore = createDataStore("vipConfig.json");

function createVipConfigManager() {
  async function getGuildTiers(guildId) {
    if (!guildId) return {};
    const data = await vipConfigStore.load();
    return data[guildId] || {};
  }

  async function getTierConfig(guildId, tierId) {
    if (!guildId || !tierId) return null;
    const tiers = await getGuildTiers(guildId);
    const raw = tiers[tierId];
    if (!raw) return null;
    const limits = raw.limits || {};
    return {
      id: tierId,
      name: raw.name ?? "VIP",
      price: raw.price ?? 0,
      roleId: raw.roleId ?? null,
      days: raw.days ?? 0,
      maxDamas: raw.maxDamas ?? limits.damas ?? 1,
      canFamily: raw.canFamily ?? limits.allowFamily ?? false,
      hasSecondRole: raw.hasSecondRole ?? false,
      maxSecondRoleMembers: raw.maxSecondRoleMembers ?? limits.secondRoleMembers ?? 0,
      maxFamilyMembers: raw.maxFamilyMembers ?? limits.familyMembers ?? 0,
    };
  }

  async function setGuildTier(guildId, tierId, tierData) {
    if (!guildId || !tierId) return;
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      tiers[tierId] = { ...(tiers[tierId] || {}), ...tierData };
      return tiers;
    });
  }

  async function removeGuildTier(guildId, tierId) {
    if (!guildId || !tierId) return;
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      delete tiers[tierId];
      return tiers;
    });
  }

  async function getMemberTier(member) {
    if (!member?.guild?.id) return null;
    const tiers = await getGuildTiers(member.guild.id);
    let melhor = null;
    let maiorPreco = -1;

    for (const [id, tier] of Object.entries(tiers)) {
      if (member.roles.cache.has(tier.roleId)) {
        const preco = tier.price ?? 0;
        if (preco > maiorPreco) {
          maiorPreco = preco;
          melhor = await getTierConfig(member.guild.id, id);
        }
      }
    }
    return melhor;
  }

  return { getGuildTiers, getTierConfig, setGuildTier, removeGuildTier, getMemberTier };
}

module.exports = { createVipConfigManager };
