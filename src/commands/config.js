const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { getGuildConfig, setGuildConfig } = require("../config/guildConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configurações gerais do servidor (Logs, Welcome, Ticket, Separadores)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("Define o canal de logs")
        .addChannelOption((opt) => opt.setName("canal").setDescription("Canal para enviar logs").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("welcome")
        .setDescription("Configura mensagens de boas-vindas")
        .addChannelOption((opt) => opt.setName("canal").setDescription("Canal de boas-vindas").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((opt) => opt.setName("mensagem").setDescription("Mensagem (use {user} para mencionar)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("ticket_category")
        .setDescription("Define a categoria onde os tickets serão criados")
        .addChannelOption((opt) => opt.setName("categoria").setDescription("Categoria dos tickets").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    ),
};
