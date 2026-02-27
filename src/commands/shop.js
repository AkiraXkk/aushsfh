const { SlashCommandBuilder } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Loja do servidor")
    .addSubcommand((sub) =>
      sub
        .setName("vip")
        .setDescription("Ver planos VIP disponíveis")
    )
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("Comprar item da loja")
        .addStringOption((opt) => 
          opt.setName("item")
            .setDescription("Item para comprar")
            .setRequired(true)
            .addChoices(
              { name: "vip_days", value: "vip_days" },
              { name: "role_color", value: "role_color" },
              { name: "custom_name", value: "custom_name" }
            )
        )
        .addIntegerOption((opt) => 
          opt.setName("quantity")
            .setDescription("Quantidade")
            .setMinValue(1)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const economyService = interaction.client.services.economy;
    const vipService = interaction.client.services.vip;
    const vipConfig = interaction.client.services.vipConfig;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "vip") {
      // Mostrar planos VIP disponíveis
      const tiers = await vipConfig.getGuildTiers(guildId);
      
      if (!tiers || Object.keys(tiers).length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed("Não há planos VIP disponíveis neste servidor.")],
          ephemeral: true,
        });
      }

      const fields = Object.entries(tiers).map(([tierId, tierData]) => ({
        name: `💎 ${tierData.name || tierId}`,
        value: `**${tierData.price || 0} WDA Coins** por dia\n` +
               `📅 Duração: ${tierData.days === 0 ? 'Permanente' : `${tierData.days} dias`}\n` +
               `🎁 Benefícios: ${tierData.maxDamas} Damas, Família: ${tierData.canFamily ? '✅' : '❌'}, Cargo Extra: ${tierData.hasSecondRole ? '✅' : '❌'}`
      }));

      return interaction.reply({
        embeds: [createEmbed({
          title: "💎 Planos VIP Disponíveis",
          description: "Escolha seu plano e use `/vipbuy` para comprar!",
          fields,
          color: 0x9b59b6,
          footer: { text: "Use /vipbuy [dias] para comprar" }
        })],
        ephemeral: true
      });
    }

    if (sub === "buy") {
      const item = interaction.options.getString("item");
      const quantity = interaction.options.getInteger("quantity");

      if (item === "vip_days") {
        // Redirecionar para o comando vipbuy aprimorado
        return interaction.reply({
          embeds: [createEmbed({
            title: "💳 Compra de VIP",
            description: "Para comprar dias de VIP, use o comando `/vipbuy`.\n\n" +
                       "Ele oferece uma interface mais completa com todos os planos disponíveis e " +
                       "opções de pagamento em WDA Coins ou R$.",
            color: 0x3498db
          })],
          ephemeral: true
        });
      }

      if (item === "role_color") {
        const cost = quantity * 5000; // 5000 moedas por cor
        const balance = await economyService.getBalance(userId);
        
        if (balance.coins < cost) {
          return interaction.reply({
            embeds: [createErrorEmbed(`Saldo insuficiente! Você precisa de **${cost} 🪙** mas tem apenas **${balance.coins} 🪙**.`)],
            ephemeral: true
          });
        }

        await economyService.removeCoins(userId, cost);
        
        return interaction.reply({
          embeds: [createSuccessEmbed(`Você comprou **${quantity}** mudança(s) de cor de cargo por **${cost} 🪙**!\n\nUse \`/vip panel\` para personalizar seu cargo.`)],
          ephemeral: true
        });
      }

      if (item === "custom_name") {
        const cost = quantity * 10000; // 10000 moedas por nome personalizado
        const balance = await economyService.getBalance(userId);
        
        if (balance.coins < cost) {
          return interaction.reply({
            embeds: [createErrorEmbed(`Saldo insuficiente! Você precisa de **${cost} 🪙** mas tem apenas **${balance.coins} 🪙**.`)],
            ephemeral: true
          });
        }

        await economyService.removeCoins(userId, cost);
        
        return interaction.reply({
          embeds: [createSuccessEmbed(`Você comprou **${quantity}** alteração(ões) de nome personalizado por **${cost} 🪙**!\n\nUse \`/vip panel\` para personalizar seu nome.`)],
          ephemeral: true
        });
      }

      // Item não reconhecido
      return interaction.reply({
        embeds: [createErrorEmbed("Item não encontrado na loja.")],
        ephemeral: true
      });
    }
  }
};
