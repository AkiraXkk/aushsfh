const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { getGuildConfig, setGuildConfig } = require("../config/guildConfig");

const { createDataStore } = require("../store/dataStore");

const ticketStore = createDataStore("tickets.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Sistema de Tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Envia o painel de tickets para o canal atual")
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Fecha o ticket atual (apenas em canais de ticket)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lista todos os tickets abertos")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const logService = interaction.client.services.log;

    if (sub === "setup") {
      const guildConfig = await getGuildConfig(interaction.guildId);
      const categoryId = guildConfig.ticketCategoryId;
      
      if (!categoryId) {
        return interaction.reply({ 
          embeds: [createErrorEmbed("Configure a categoria dos tickets primeiro usando `/config ticket_category`.")], 
          ephemeral: true 
        });
      }

      const embed = createEmbed({
        title: "🎫 Central de Ajuda",
        description: "Clique no botão abaixo para abrir um ticket de suporte.\nNossa equipe irá atendê-lo em breve.",
        color: 0x3498db,
        footer: "Suporte VIP e Geral"
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Abrir Ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("📩")
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: "Painel de tickets enviado!", ephemeral: true });
    }

    if (sub === "close") {
      // Validação melhorada - verifica se é ticket pelo banco de dados
      const tickets = await ticketStore.load();
      const ticketInfo = tickets[interaction.channelId];
      
      if (!ticketInfo) {
        return interaction.reply({ 
          embeds: [createErrorEmbed("Este comando só pode ser usado em canais de ticket.")], 
          ephemeral: true 
        });
      }

      // Log do fechamento
      if (logService) {
        await logService.log(interaction.guild, {
          title: "🔒 Ticket Fechado",
          description: `Ticket **${interaction.channel.name}** foi fechado por **${interaction.user.tag}**.`,
          color: 0xe67e22,
          fields: [
            { name: "👤 Fechado por", value: interaction.user.tag, inline: true },
            { name: "📅 Aberto em", value: `<t:${Math.floor(ticketInfo.openedAt / 1000)}>` , inline: true },
            { name: "👥 Criador", value: `<@${ticketInfo.userId}>`, inline: true }
          ],
          user: interaction.user
        });
      }

      // Remove do banco de dados
      delete tickets[interaction.channelId];
      await ticketStore.save(tickets);

      await interaction.reply({ 
        embeds: [createEmbed({ description: "🔒 Ticket será fechado em 5 segundos...", color: 0xF1C40F })] 
      });
      
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }

    if (sub === "list") {
      const tickets = await ticketStore.load();
      const openTickets = Object.entries(tickets)
        .filter(([id, info]) => !info.closedAt)
        .sort((a, b) => b[1].openedAt - a[1].openedAt);

      if (openTickets.length === 0) {
        return interaction.reply({
          embeds: [createEmbed({
            title: "📋 Tickets Abertos",
            description: "Não há tickets abertos no momento.",
            color: 0x3498db
          })],
          ephemeral: true
        });
      }

      const fields = openTickets.slice(0, 10).map(([channelId, info]) => ({
        name: `🎫 ${info.channelName}`,
        value: `Criado por <@${info.userId}>\nAberto em <t:${Math.floor(info.openedAt / 1000)}>` ,
        inline: false
      }));

      await interaction.reply({
        embeds: [createEmbed({
          title: "📋 Tickets Abertos",
          description: `Mostrando ${Math.min(openTickets.length, 10)} tickets mais recentes.`,
          fields,
          color: 0x3498db
        })],
        ephemeral: true
      });
    }
  },

  // Handler para o botão (chamado no index.js)
  async handleButton(interaction) {
    const logService = interaction.client.services.log;

    if (interaction.customId === "open_ticket") {
      const guildConfig = await getGuildConfig(interaction.guildId);
      const categoryId = guildConfig.ticketCategoryId;
      
      if (!categoryId) {
        return interaction.reply({ 
          content: "O sistema de tickets não está configurado (falta categoria). Peça a um admin para usar `/config ticket_category`.", 
          ephemeral: true 
        });
      }

      // Verifica se já tem ticket aberto
      const tickets = await ticketStore.load();
      const existingTicket = Object.entries(tickets).find(([id, info]) => 
        info.userId === interaction.user.id && !info.closedAt
      );
      
      if (existingTicket) {
        return interaction.reply({ 
          content: `Você já tem um ticket aberto: <#${existingTicket[0]}>`, 
          ephemeral: true 
        });
      }

      // Cria o canal
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username.toLowerCase().replace(/\s+/g, '-')}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      // Salva no banco de dados
      tickets[channel.id] = {
        userId: interaction.user.id,
        channelName: channel.name,
        channelId: channel.id,
        openedAt: Date.now(),
        closedAt: null
      };
      await ticketStore.save(tickets);

      // Log da criação
      if (logService) {
        await logService.log(interaction.guild, {
          title: "🎫 Ticket Criado",
          description: `**${interaction.user.tag}** abriu um novo ticket.`,
          color: 0x2ecc71,
          fields: [
            { name: "👤 Usuário", value: interaction.user.tag, inline: true },
            { name: "📋 Canal", value: channel.toString(), inline: true },
            { name: "📅 Criado em", value: `<t:${Math.floor(Date.now() / 1000)}>` , inline: true }
          ],
          user: interaction.user
        });
      }

      const embed = createEmbed({
        title: `Ticket de ${interaction.user.tag}`,
        description: "Descreva seu problema aqui. A equipe de suporte chegará em breve.",
        color: 0x2ecc71,
        footer: "Use /ticket close para fechar"
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket_btn")
          .setLabel("Fechar Ticket")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
      );

      await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === "close_ticket_btn") {
      // Validação pelo banco de dados
      const tickets = await ticketStore.load();
      const ticketInfo = tickets[interaction.channelId];
      
      if (!ticketInfo) {
        return interaction.reply({ 
          embeds: [createErrorEmbed("Este não é um ticket válido.")], 
          ephemeral: true 
        });
      }

      // Log do fechamento
      if (logService) {
        await logService.log(interaction.guild, {
          title: "🔒 Ticket Fechado",
          description: `Ticket **${interaction.channel.name}** foi fechado por **${interaction.user.tag}**.`,
          color: 0xe67e22,
          fields: [
            { name: "👤 Fechado por", value: interaction.user.tag, inline: true },
            { name: "📅 Aberto em", value: `<t:${Math.floor(ticketInfo.openedAt / 1000)}>` , inline: true },
            { name: "👥 Criador", value: `<@${ticketInfo.userId}>`, inline: true }
          ],
          user: interaction.user
        });
      }

      // Remove do banco de dados
      delete tickets[interaction.channelId];
      await ticketStore.save(tickets);

      await interaction.reply({ 
        embeds: [createEmbed({ description: "🔒 Ticket será fechado em 5 segundos...", color: 0xF1C40F })] 
      });
      
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
};
