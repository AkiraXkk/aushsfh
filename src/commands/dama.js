const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { getGuildConfig } = require("../config/guildConfig");

/**
 * Resolve a quantidade máxima de damas baseada no Tier VIP do usuário
 */
async function resolveMaxDamas(member, guildId, client) {
  const vipService = client.services.vip;
  const entry = vipService.getVip(member.id);
  
  // Se não for VIP ou não houver entrada, o limite padrão é 1
  if (!entry) return 1;

  const tierConfig = await vipService.getTierConfig(guildId, entry.tierId);
  // Retorna o limite definido no /vipadmin tier ou 1 como fallback
  return tierConfig?.maxDamas || 1;
}

async function buildPanelEmbed(guildId) {
  const config = await getGuildConfig(guildId);
  const damaRoleId = config?.damaRoleId;
  const damaPermRoleId = config?.damaPermRoleId;

  return createEmbed({
    title: "⚙️ Painel Admin — Sistema de Damas",
    description: [
      `**Cargo de Dama:** ${damaRoleId ? `<@&${damaRoleId}>` : "❌ Não definido"}`,
      `**Cargo base (permissão):** ${damaPermRoleId ? `<@&${damaPermRoleId}>` : "❌ Não definido"}`,
      "",
      "**Funcionamento:**",
      "O limite de damas agora é lido dinamicamente das configurações de **Tier VIP** do servidor.",
    ].join("\n"),
    color: 0x5865f2,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dama")
    .setDescription("Sistema de Primeira Dama")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Define sua primeira dama")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Sua dama").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove uma dama específica ou todas")
        .addUserOption((opt) =>
          opt.setName("usuario").setDescription("Dama específica")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Painel de configuração (Admin)")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId, user, client, member } = interaction;
    const vipService = client.services.vip;

    if (sub === "config") {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [createErrorEmbed("Sem permissão.")],
          ephemeral: true,
        });
      }
      return interaction.reply({
        embeds: [await buildPanelEmbed(guildId)],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("dama_cfg:set_roles").setLabel("Configurar Cargos").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("dama_cfg:close").setLabel("Fechar").setStyle(ButtonStyle.Secondary)
            )
        ],
        ephemeral: true,
      });
    }

    if (sub === "set") {
      const config = await getGuildConfig(guildId);
      const target = interaction.options.getUser("usuario");

      // Verificação de Limite Dinâmico
      const maxDamas = await resolveMaxDamas(member, guildId, client);
      const currentDamas = await vipService.getDamasCount(user.id); // Supõe-se que exista este método no seu service

      if (currentDamas >= maxDamas) {
        return interaction.reply({
          embeds: [createErrorEmbed(`Você atingiu seu limite de **${maxDamas}** dama(s). Melhore seu VIP para aumentar!`)],
          ephemeral: true,
        });
      }

      if (target.id === user.id) return interaction.reply({ embeds: [createErrorEmbed("Não pode ser sua própria dama.")], ephemeral: true });
      if (target.bot) return interaction.reply({ embeds: [createErrorEmbed("Bots não podem ser damas.")], ephemeral: true });

      // Lógica de atribuição de cargo e salvamento
      await vipService.addDama(user.id, target.id);
      return interaction.reply({
        embeds: [createSuccessEmbed(`${target} agora é sua dama! (Limite: ${currentDamas + 1}/${maxDamas})`) ]
      });
    }

    if (sub === "remove") {
        const target = interaction.options.getUser("usuario");
        await vipService.removeDama(user.id, target?.id);
        return interaction.reply({ embeds: [createSuccessEmbed("Dama(s) removida(s) com sucesso.")] });
    }
  },
};
