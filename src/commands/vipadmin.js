const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { createSuccessEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Administração total do sistema VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // CONFIGURAÇÃO DOS TIERS (Regras completas)
    .addSubcommand(s => s.setName("tier").setDescription("Configura as regras de um plano VIP")
        .addStringOption(o => o.setName("id").setDescription("ID único (ex: gold)").setRequired(true))
        .addStringOption(o => o.setName("nome").setDescription("Nome de exibição").setRequired(true))
        .addNumberOption(o => o.setName("preco").setDescription("Preço").setRequired(true))
        .addRoleOption(o => o.setName("cargo_principal").setDescription("Cargo fixo do cliente").setRequired(true))
        .addIntegerOption(o => o.setName("dias").setDescription("Duração em dias (0 = Permanente)").setRequired(true))
        .addIntegerOption(o => o.setName("limite_damas").setDescription("Qtd de Primeiras Damas permitidas").setRequired(true))
        .addBooleanOption(o => o.setName("familia").setDescription("Pode criar família?").setRequired(true))
        .addBooleanOption(o => o.setName("duplo_cargo").setDescription("Pode criar 2º cargo personalizável?").setRequired(true)))
    
    // SETUP DE CANAIS/CATEGORIAS
    .addSubcommand(s => s.setName("setup").setDescription("Configura categoria e cargo base")
        .addRoleOption(o => o.setName("cargo_base").setDescription("Cargo VIP principal"))
        .addChannelOption(o => o.setName("categoria").setDescription("Categoria das salas").addChannelTypes(ChannelType.GuildCategory))),

  async execute(interaction) {
    const vipService = interaction.client.services.vip;
    const sub = interaction.options.getSubcommand();

    if (sub === "tier") {
        const id = interaction.options.getString("id");
        const config = {
            name: interaction.options.getString("nome"),
            price: interaction.options.getNumber("preco"),
            roleId: interaction.options.getRole("cargo_principal").id,
            days: interaction.options.getInteger("dias"),
            maxDamas: interaction.options.getInteger("limite_damas"),
            canFamily: interaction.options.getBoolean("familia"),
            hasSecondRole: interaction.options.getBoolean("duplo_cargo")
        };

        await vipService.updateTier(interaction.guildId, id, config);
        
        return interaction.reply({ 
            embeds: [createSuccessEmbed(`**Plano ${config.name} configurado!**
            • Preço: \`R$ ${config.price}\`
            • Duração: ${config.days === 0 ? "♾️ Permanente" : config.days + " dias"}
            • Limite Damas: \`${config.maxDamas}\`
            • Família: ${config.canFamily ? "✅" : "❌"}
            • 2º Cargo: ${config.hasSecondRole ? "✅" : "❌"}`)], 
            ephemeral: true 
        });
    }
    // ... manter lógica do subcomando setup enviada anteriormente
  }
};
