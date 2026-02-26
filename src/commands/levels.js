const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");

const levelsStore = createDataStore("levels.json");
const levelRolesStore = createDataStore("levelRoles.json");
const levelConfigStore = createDataStore("levelConfig.json");

async function getLevelRoleConfig(guildId) {
  if (!guildId) return {};
  const data = await levelRolesStore.load();
  return data[guildId] || {};
}

async function setLevelRole(guildId, nivel, roleId) {
  if (!guildId) return;
  const chave = String(nivel);
  await levelRolesStore.update(guildId, (atual) => {
    const roles = atual || {};
    if (roleId) roles[chave] = roleId; else delete roles[chave];
    return roles;
  });
}

async function applyLevelRoles(member, nivelAnterior, novoNivel) {
  if (!member?.guild?.id) return;
  const config = await getLevelRoleConfig(member.guild.id);
  const cargoNovoId = config[String(novoNivel)];
  const cargoAntigoId = config[String(nivelAnterior)];

  try {
    if (cargoAntigoId && member.roles.cache.has(cargoAntigoId)) {
      await member.roles.remove(cargoAntigoId);
    }
    if (cargoNovoId) {
      await member.roles.add(cargoNovoId);
    }
  } catch (_) {}
}

async function addXp(userId, amount = 10) {
  let subiuNivel = false;
  let novoNivel = 1;
  let nivelAnterior = 1;

  await levelsStore.update(userId, (current) => {
    const data = current || { xp: 0, level: 1 };
    nivelAnterior = data.level;
    data.xp += amount;
    const xpNeeded = data.level * 100;

    if (data.xp >= xpNeeded) {
      data.level += 1;
      data.xp = 0;
      subiuNivel = true;
      novoNivel = data.level;
    }

    return data;
  });

  return { subiuNivel, novoNivel, nivelAnterior };
}

async function getLevelConfig(guildId) {
  if (!guildId) return { xpPerMessage: 10, xpPerMinuteVoice: 60, immuneRoleIds: [], multiplierRoles: {} };
  const data = await levelConfigStore.load();
  const config = data[guildId] || {};
  return {
    xpPerMessage: Number.isFinite(config.xpPerMessage) ? config.xpPerMessage : 10,
    xpPerMinuteVoice: Number.isFinite(config.xpPerMinuteVoice) ? config.xpPerMinuteVoice : 60,
    immuneRoleIds: Array.isArray(config.immuneRoleIds) ? config.immuneRoleIds : [],
    multiplierRoles: typeof config.multiplierRoles === "object" && config.multiplierRoles !== null ? config.multiplierRoles : {},
  };
}

async function setLevelConfig(guildId, patch) {
  if (!guildId) return;
  await levelConfigStore.update(guildId, (current) => {
    const atual = current || {};
    return { ...atual, ...patch };
  });
}

async function addXpForMessage(member) {
  if (!member?.guild?.id) return { subiuNivel: false, novoNivel: 1, nivelAnterior: 1 };
  const config = await getLevelConfig(member.guild.id);

  if (config.immuneRoleIds.some((roleId) => member.roles.cache.has(roleId))) {
    return { subiuNivel: false, novoNivel: 1, nivelAnterior: 1 };
  }

  let fator = 1;
  for (const [roleId, mult] of Object.entries(config.multiplierRoles)) {
    if (member.roles.cache.has(roleId)) {
      fator = Math.max(fator, Number(mult) || 1);
    }
  }

  const quantidade = Math.max(0, Math.round((config.xpPerMessage || 10) * fator));
  const resultado = await addXp(member.id, quantidade);

  await levelsStore.update(member.id, (current) => {
    const dados = current || { xp: 0, level: 1 };
    dados.messages = (dados.messages || 0) + 1;
    return dados;
  });

  return resultado;
}

async function addXpForVoiceTick(member, minutos = 1) {
  if (!member?.guild?.id) return { subiuNivel: false, novoNivel: 1, nivelAnterior: 1 };
  const config = await getLevelConfig(member.guild.id);

  if (config.immuneRoleIds.some((roleId) => member.roles.cache.has(roleId))) {
    return { subiuNivel: false, novoNivel: 1, nivelAnterior: 1 };
  }

  let fator = 1;
  for (const [roleId, mult] of Object.entries(config.multiplierRoles)) {
    if (member.roles.cache.has(roleId)) {
      fator = Math.max(fator, Number(mult) || 1);
    }
  }

  const base = config.xpPerMinuteVoice || 60;
  const quantidade = Math.max(0, Math.round(base * minutos * fator));
  const resultado = await addXp(member.id, quantidade);

  const incrementoMs = minutos * 60 * 1000;
  await levelsStore.update(member.id, (current) => {
    const dados = current || { xp: 0, level: 1 };
    dados.voiceMs = (dados.voiceMs || 0) + incrementoMs;
    return dados;
  });

  return resultado;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("Sistema de níveis")
    .addSubcommand((sub) =>
      sub
        .setName("rank")
        .setDescription("Verifica seu nível e XP")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário (opcional)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("leaderboard").setDescription("Mostra o top 10 usuários com mais XP")
    )
    .addSubcommand((sub) =>
      sub
        .setName("xpconfig")
        .setDescription("Configura XP por mensagem/voz e multiplicadores (Admin)")
        .addIntegerOption((opt) =>
          opt.setName("xp_msg").setDescription("XP base por mensagem").setMinValue(0).setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt.setName("xp_voz").setDescription("XP base por minuto em call").setMinValue(0).setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName("cargo_imune").setDescription("Cargo que não ganha XP").setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName("cargo_multiplicador").setDescription("Cargo com bônus de XP").setRequired(false)
        )
        .addNumberOption((opt) =>
          opt
            .setName("fator")
            .setDescription("Multiplicador de XP para o cargo")
            .setMinValue(0.1)
            .setMaxValue(10)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Mapeia nível → cargo (Admin)")
        .addIntegerOption((opt) => opt.setName("nivel").setDescription("Nível").setRequired(true).setMinValue(1))
        .addRoleOption((opt) => opt.setName("cargo").setDescription("Cargo a atribuir ao atingir esse nível").setRequired(true))
    ),

  getLevelRoleConfig,
  setLevelRole,
  applyLevelRoles,
  addXp,
  addXpForMessage,
  addXpForVoiceTick,
  getLevelConfig,
  setLevelConfig,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const levels = await levelsStore.load();

    if (sub === "xpconfig") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [createErrorEmbed("Sem permissão.")], ephemeral: true });
      }

      const patch = {};
      const xpMsg = interaction.options.getInteger("xp_msg");
      const xpVoz = interaction.options.getInteger("xp_voz");
      const cargoImune = interaction.options.getRole("cargo_imune");
      const cargoMultiplicador = interaction.options.getRole("cargo_multiplicador");
      const fator = interaction.options.getNumber("fator");

      if (typeof xpMsg === "number") patch.xpPerMessage = xpMsg;
      if (typeof xpVoz === "number") patch.xpPerMinuteVoice = xpVoz;

      const atual = await getLevelConfig(interaction.guildId);

      if (cargoImune) {
        const lista = new Set(atual.immuneRoleIds || []);
        lista.add(cargoImune.id);
        patch.immuneRoleIds = Array.from(lista);
      }

      if (cargoMultiplicador && typeof fator === "number") {
        patch.multiplierRoles = {
          ...(atual.multiplierRoles || {}),
          [cargoMultiplicador.id]: fator,
        };
      }

      await setLevelConfig(interaction.guildId, patch);

      return interaction.reply({
        embeds: [createSuccessEmbed("Configuração de XP atualizada.")],
        ephemeral: true,
      });
    }

    if (sub === "config") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [createErrorEmbed("Sem permissão.")], ephemeral: true });
      }
      const nivel = interaction.options.getInteger("nivel");
      const cargo = interaction.options.getRole("cargo");
      await setLevelRole(interaction.guildId, nivel, cargo.id);
      return interaction.reply({
        embeds: [createSuccessEmbed(`Nível **${nivel}** agora concede o cargo ${cargo}.`)],
        ephemeral: true,
      });
    }

    if (sub === "rank") {
      const user = interaction.options.getUser("usuario") || interaction.user;
      const data = levels[user.id] || { xp: 0, level: 1 };
      const xpNeeded = data.level * 100;
      const progress = Math.min(data.xp / xpNeeded, 1);
      const filled = Math.floor(progress * 10);
      const bar = "🟦".repeat(filled) + "⬜".repeat(10 - filled);
      const totalMensagens = data.messages || 0;
      const totalVoiceMs = data.voiceMs || 0;
      const totalMinutos = Math.floor(totalVoiceMs / 60000);

      return interaction.reply({
        embeds: [
          createEmbed({
            title: `🌟 Nível de ${user.username}`,
            fields: [
              { name: "Nível", value: `${data.level}`, inline: true },
              { name: "XP Total", value: `${data.xp}`, inline: true },
              { name: "Progresso", value: `${data.xp}/${xpNeeded} XP\n${bar}` },
              { name: "Mensagens", value: `${totalMensagens}`, inline: true },
              { name: "Tempo em call", value: `${totalMinutos} min`, inline: true },
            ],
            thumbnail: user.displayAvatarURL(),
            color: 0x9b59b6,
          }),
        ],
      });
    }

    if (sub === "leaderboard") {
      const sorted = Object.entries(levels)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.level * 1000 + b.xp - (a.level * 1000 + a.xp))
        .slice(0, 10);

      if (sorted.length === 0) {
        return interaction.reply({
          embeds: [createEmbed({ description: "Ninguém ganhou XP ainda." })],
          ephemeral: true,
        });
      }

      const linhas = sorted.map(
        (entry, i) => `**${i + 1}.** <@${entry.id}> — Nível ${entry.level} (${entry.xp} XP)`
      );
      return interaction.reply({
        embeds: [createEmbed({ title: "🏆 Top 10 Níveis", description: linhas.join("\n"), color: 0xf1c40f })],
      });
    }
  },
};
