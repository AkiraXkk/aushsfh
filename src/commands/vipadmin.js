const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed, createEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Administração total do sistema VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // ADICIONAR VIP
    .addSubcommand(s => s.setName("add").setDescription("Dá VIP a um usuário")
        .addUserOption(o => o.setName("usuario").setDescription("O usuário").setRequired(true))
        .addIntegerOption(o => o.setName("dias").setDescription("Dias (vazio = permanente)"))
        .addStringOption(o => o.setName("tier").setDescription("ID do Tier").setAutocomplete(true)))
    // REMOVER VIP
    .addSubcommand(s => s.setName("remove").setDescription("Remove o VIP de alguém")
        .addUserOption(o => o.setName("usuario").setDescription("O usuário").setRequired(true)))
    // CONFIGURAÇÃO DO SISTEMA (Vindo do antigo vipsetup)
    .addSubcommand(s => s.setName("setup").setDescription("Configura categoria e cargo base")
        .addRoleOption(o => o.setName("cargo_base").setDescription("Cargo VIP principal"))
        .addChannelOption(o => o.setName("categoria").setDescription("Categoria das salas").addChannelTypes(ChannelType.GuildCategory))),

  async execute(interaction) {
    const vipService = interaction.client.services.vip;
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      const role = interaction.options.getRole("cargo_base");
      const category = interaction.options.getChannel("categoria");
      const patch = {};
      if (role) patch.vipRoleId = role.id;
      if (category) patch.vipCategoryId = category.id;

      await vipService.setGuildConfig(interaction.guildId, patch);
      return interaction.reply({ embeds: [createSuccessEmbed("Configurações do sistema VIP atualizadas!")], ephemeral: true });
    }

    if (sub === "add") {
        const user = interaction.options.getUser("usuario");
        const days = interaction.options.getInteger("dias");
        const tier = interaction.options.getString("tier");
        await vipService.addVip(user.id, { days, tierId: tier });
        return interaction.reply({ embeds: [createSuccessEmbed(`VIP adicionado para ${user} com sucesso!`) ]});
    }

    if (sub === "remove") {
        const user = interaction.options.getUser("usuario");
        await vipService.removeVip(user.id);
        return interaction.reply({ embeds: [createSuccessEmbed(`VIP de ${user} removido.`)] });
    }
  }
};
