const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
} = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");
const { getGuildConfig, setGuildConfig } = require("../config/guildConfig");

const couplesStore = createDataStore("couples.json");

async function getDamaVipRoles(guildId) {
  const config = await getGuildConfig(guildId);
  return config?.damaVipRoles || {};
}

async function resolveMaxDamas(member, guildId) {
  const damaVipRoles = await getDamaVipRoles(guildId);
  let max = 1;
  for (const [roleId, data] of Object.entries(damaVipRoles)) {
    if (member.roles.cache.has(roleId) && data.maxDamas > max) {
      max = data.maxDamas;
    }
  }
  return max;
}

async function buildPanelEmbed(guildId) {
  const config = await getGuildConfig(guildId);
  const damaVipRoles = config?.damaVipRoles || {};
  const damaRoleId = config?.damaRoleId;
  const damaPermRoleId = config?.damaPermRoleId;
  const vipSepId = config?.vipRoleSeparatorId;
  const famSepId = config?.familyRoleSeparatorId;
  const hasVipRoles = Object.keys(damaVipRoles).length > 0;

  const rolesDesc = hasVipRoles
    ? Object.entries(damaVipRoles)
        .map(([id, d]) => `> <@&${id}> — **${d.maxDamas}** dama(s)`)
        .join("\n")
    : "> Nenhum cargo VIP configurado.";

  return createEmbed({
    title: "⚙️ Painel Admin — Sistema de Damas",
    description: [
      `**Cargo de Dama:** ${damaRoleId ? `<@&${damaRoleId}>` : "❌ Não definido"}`,
      `**Cargo base (permissão):** ${damaPermRoleId ? `<@&${damaPermRoleId}>` : "❌ Não definido"}`,
      `**Separador VIP:** ${vipSepId ? `<@&${vipSepId}>` : "❌ Não definido"}`,
      `**Separador Família:** ${famSepId ? `<@&${famSepId}>` : "❌ Não definido"}`,
      "",
      "**Cargos VIP e limites de damas:**",
      rolesDesc,
      "",
      "Membros com múltiplos cargos VIP terão o **maior** limite aplicado.",
    ].join("\n"),
    color: 0x5865f2,
    footer: { text: "Apenas administradores podem usar este painel." },
  });
}

function buildPanelComponents(hasVipRoles) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dama_cfg:set_roles")
      .setLabel("🎭 Definir Cargos Base")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dama_cfg:add_vip")
      .setLabel("➕ Adicionar Cargo VIP")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("dama_cfg:remove_vip")
      .setLabel("🗑️ Remover Cargo VIP")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasVipRoles)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dama_cfg:separadores")
      .setLabel("⚙️ Separadores")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("dama_cfg:close")
      .setLabel("✖ Fechar")
      .setStyle(ButtonStyle.Secondary)
  );
  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dama")
    .setDescription("Sistema de Primeira Dama")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Define sua primeira dama (Requer cargo de permissão)")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Sua dama").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove uma dama específica ou todas as suas damas")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Dama específica para remover (opcional)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Abre o painel de configuração do sistema de Damas (Admin)")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === "config") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [createErrorEmbed("Você precisa da permissão **Gerenciar Servidor** para acessar este painel.")],
          ephemeral: true,
        });
      }

      const config = await getGuildConfig(guildId);
      const hasVipRoles = Object.keys(config?.damaVipRoles || {}).length > 0;

      return interaction.reply({
        embeds: [await buildPanelEmbed(guildId)],
        components: buildPanelComponents(hasVipRoles),
        ephemeral: true,
      });
    }

    if (sub === "set") {
      const config = await getGuildConfig(guildId);

      if (!config?.damaPermRoleId || !config?.damaRoleId) {
        return interaction.reply({
          embeds: [createErrorEmbed("O sistema de Dama não está configurado. Use `/dama config`.")],
          ephemeral: true,
        });
      }

      const damaVipRoles = config?.damaVipRoles || {};
      const hasPermission =
        interaction.member.roles.cache.has(config.damaPermRoleId) ||
        Object.keys(damaVipRoles).some((id) => interaction.member.roles.cache.has(id));

      if (!hasPermission) {
        return interaction.reply({
          embeds: [createErrorEmbed(`Você precisa ter o cargo <@&${config.damaPermRoleId}> para definir uma dama.`)],
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser("usuario");

      if (target.id === userId) {
        return interaction.reply({
          embeds: [createErrorEmbed("Você não pode se definir como sua própria dama.")],
          ephemeral: true,
        });
      }

      if (target.bot) {
        return interaction.reply({
          embeds: [createErrorEmbed("Você não pode definir um bot como dama.")],
          ephemeral: true,
        });
      }
    }
  },
};
