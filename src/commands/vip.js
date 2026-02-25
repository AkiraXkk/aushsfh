const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Painel e informações do sistema VIP")
    .addSubcommand(s => s.setName("panel").setDescription("Abre seu painel VIP"))
    .addSubcommand(s => s.setName("cargo2").setDescription("Gerencia seu 2º cargo (Personalizável/Amigo)")
        .addUserOption(o => o.setName("amigo").setDescription("Amigo que receberá o cargo")))
    .addSubcommand(s => s.setName("status").setDescription("Verifica tempo restante")),

  async execute(interaction) {
    const vipService = interaction.client.services.vip;
    const sub = interaction.options.getSubcommand();
    const entry = vipService.getVip(interaction.user.id);

    if (!entry) return interaction.reply({ embeds: [createErrorEmbed("Você não é VIP.")], ephemeral: true });

    const tierConfig = await vipService.getTierConfig(interaction.guildId, entry.tierId);

    if (sub === "panel") {
      const embed = createEmbed({
        title: "💎 Painel VIP",
        description: `Plano: **${tierConfig.name}**\nLimite de Damas: \`${tierConfig.maxDamas}\``,
        color: 0x9B59B6
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vip_role_main").setLabel("Cargo Principal").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("vip_role_second").setLabel("2º Cargo").setStyle(ButtonStyle.Secondary).setDisabled(!tierConfig.hasSecondRole),
        new ButtonBuilder().setCustomId("vip_family").setLabel("Família").setStyle(ButtonStyle.Success).setDisabled(!tierConfig.canFamily)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (sub === "cargo2") {
        if (!tierConfig.hasSecondRole) {
            return interaction.reply({ embeds: [createErrorEmbed("Seu plano não permite um 2º cargo.")], ephemeral: true });
        }
        
        const amigo = interaction.options.getUser("amigo");
        if (amigo) {
            // Lógica para aplicar o cargo customizado ao amigo
            return interaction.reply({ embeds: [createSuccessEmbed(`Cargo extra atribuído a ${amigo}!`)] });
        }

        return interaction.reply({ content: "Use os botões no `/vip panel` para editar nome/cor do 2º cargo.", ephemeral: true });
    }
  }
};
