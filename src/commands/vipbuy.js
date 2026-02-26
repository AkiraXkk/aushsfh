const { SlashCommandBuilder } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");

const VIP_PRICE_PER_DAY = 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipbuy")
    .setDescription("Compra dias de VIP usando suas moedas")
    .addIntegerOption((opt) =>
      opt.setName("dias").setDescription("Quantos dias de VIP deseja comprar?").setMinValue(1).setRequired(true)
    ),

  async execute(interaction) {
    const economyService = interaction.client.services.economy;
    const vipService = interaction.client.services.vip;
    const vipRoleManager = interaction.client.services.vipRole;
    const logService = interaction.client.services.log;

    const dias = interaction.options.getInteger("dias");
    const custo = dias * VIP_PRICE_PER_DAY;
    const userId = interaction.user.id;

    const saldo = await economyService.getBalance(userId);
    const moedas = saldo.coins || 0;

    if (moedas < custo) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            `Saldo insuficiente. Você precisa de **${custo} 🪙** e possui **${moedas} 🪙**.\nUse **/work** e **/daily** para ganhar mais moedas.`,
          ),
        ],
        ephemeral: true,
      });
    }

    const debitoOk = await economyService.removeCoins(userId, custo);
    if (!debitoOk) {
      return interaction.reply({
        embeds: [createErrorEmbed("Não foi possível debitar suas moedas. Tente novamente.")],
        ephemeral: true,
      });
    }

    const resultado = await vipService.addVip(userId, { days: dias });

    if (vipRoleManager) {
      await vipRoleManager.ensurePersonalRole(userId, { guildId: interaction.guildId }).catch(() => {});
    }

    if (logService) {
      await logService.log(interaction.guild, {
        title: "🛒 Compra de VIP",
        description: `${interaction.user} comprou **${dias} dia(s) de VIP** por **${custo} 🪙**.`,
        color: 0xf1c40f,
        user: interaction.user,
      });
    }

    const texto = resultado.created
      ? `Você comprou **${dias} dia(s)** de VIP por **${custo} 🪙**.`
      : `Seu VIP foi estendido em **${dias} dia(s)** por **${custo} 🪙**.`;

    return interaction.reply({
      embeds: [createSuccessEmbed(texto)],
      ephemeral: true,
    });
  },
};

