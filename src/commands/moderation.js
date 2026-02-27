const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Comandos de moderação")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Limpa mensagens do chat")
        .addIntegerOption((opt) =>
          opt
            .setName("quantidade")
            .setDescription("Número de mensagens para apagar (1-100)")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("ban")
        .setDescription("Bane um usuário do servidor")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário a ser banido").setRequired(true))
        .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo do banimento").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Expulsa um usuário do servidor")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário a ser expulso").setRequired(true))
        .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo da expulsão").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription("Tranca o canal atual para que membros não possam falar")
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription("Destranca o canal atual")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const logService = interaction.client.services.log;

    // CLEAR
    if (sub === "clear") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ embeds: [createErrorEmbed("Você não tem permissão para gerenciar mensagens.")], ephemeral: true });
      }

      const amount = interaction.options.getInteger("quantidade");
      
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const deleted = await interaction.channel.bulkDelete(amount, true);
        
        // Log da ação
        if (logService) {
          await logService.log(interaction.guild, {
            title: "🧹 Mensagens Apagadas",
            description: `**${interaction.user.tag}** apagou **${deleted.size}** mensagens em **${interaction.channel.name}**.`,
            color: 0x3498db,
            fields: [
              { name: "👤 Moderador", value: interaction.user.tag, inline: true },
              { name: "💬 Canal", value: interaction.channel.name, inline: true },
              { name: "📊 Quantidade", value: `${deleted.size} mensagens`, inline: true }
            ],
            user: interaction.user
          });
        }

        await interaction.editReply({ 
            embeds: [createSuccessEmbed(`Foram apagadas **${deleted.size}** mensagens com sucesso.`)] 
        });
      } catch (error) {
        await interaction.editReply({ 
            embeds: [createErrorEmbed("Erro ao apagar mensagens. Elas podem ser muito antigas (mais de 14 dias).")] 
        });
      }
    }

    // BAN
    if (sub === "ban") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ embeds: [createErrorEmbed("Você não tem permissão para banir membros.")], ephemeral: true });
      }

      const user = interaction.options.getUser("usuario");
      const reason = interaction.options.getString("motivo") || "Sem motivo especificado";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        if (!member.bannable) {
          return interaction.reply({ embeds: [createErrorEmbed("Eu não posso banir este usuário (ele pode ter um cargo maior que o meu).")], ephemeral: true });
        }
      }

      await interaction.deferReply();
      try {
        await interaction.guild.members.ban(user.id, { reason });
        
        // Log da ação
        if (logService) {
          await logService.log(interaction.guild, {
            title: "🔨 Usuário Banido",
            description: `**${user.tag}** foi banido por **${interaction.user.tag}**.`,
            color: 0xFF0000,
            fields: [
              { name: "👤 Moderador", value: interaction.user.tag, inline: true },
              { name: "👤 Usuário", value: user.tag, inline: true },
              { name: "📝 Motivo", value: reason, inline: false }
            ],
            user: interaction.user
          });
        }

        await interaction.editReply({ 
            embeds: [createEmbed({
                title: "🔨 Usuário Banido",
                description: `**${user.tag}** foi banido com sucesso.`,
                fields: [{ name: "Motivo", value: reason }],
                color: 0xFF0000 // Red
            })] 
        });
      } catch (error) {
        await interaction.editReply({ embeds: [createErrorEmbed("Ocorreu um erro ao tentar banir o usuário.")] });
      }
    }

    // KICK
    if (sub === "kick") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ embeds: [createErrorEmbed("Você não tem permissão para expulsar membros.")], ephemeral: true });
      }

      const user = interaction.options.getUser("usuario");
      const reason = interaction.options.getString("motivo") || "Sem motivo especificado";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        return interaction.reply({ embeds: [createErrorEmbed("Usuário não encontrado no servidor.")], ephemeral: true });
      }

      if (!member.kickable) {
        return interaction.reply({ embeds: [createErrorEmbed("Eu não posso expulsar este usuário.")], ephemeral: true });
      }

      await interaction.deferReply();
      try {
        await member.kick(reason);
        
        // Log da ação
        if (logService) {
          await logService.log(interaction.guild, {
            title: "🦶 Usuário Expulso",
            description: `**${user.tag}** foi expulso por **${interaction.user.tag}**.`,
            color: 0xFFA500,
            fields: [
              { name: "👤 Moderador", value: interaction.user.tag, inline: true },
              { name: "👤 Usuário", value: user.tag, inline: true },
              { name: "📝 Motivo", value: reason, inline: false }
            ],
            user: interaction.user
          });
        }

        await interaction.editReply({ 
            embeds: [createEmbed({
                title: "🦶 Usuário Expulso",
                description: `**${user.tag}** foi expulso com sucesso.`,
                fields: [{ name: "Motivo", value: reason }],
                color: 0xFFA500 // Orange
            })] 
        });
      } catch (error) {
        await interaction.editReply({ embeds: [createErrorEmbed("Ocorreu um erro ao tentar expulsar o usuário.")] });
      }
    }

    // LOCK
    if (sub === "lock") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ embeds: [createErrorEmbed("Você não tem permissão para gerenciar canais.")], ephemeral: true });
      }

      await interaction.deferReply();
      try {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
          [PermissionFlagsBits.SendMessages]: false
        });
        await interaction.editReply({ embeds: [createSuccessEmbed("O canal foi trancado.")] });
      } catch (error) {
        await interaction.editReply({ embeds: [createErrorEmbed("Erro ao trancar o canal.")] });
      }
    }

    // UNLOCK
    if (sub === "unlock") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ embeds: [createErrorEmbed("Você não tem permissão para gerenciar canais.")], ephemeral: true });
      }

      await interaction.deferReply();
      try {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
          [PermissionFlagsBits.SendMessages]: true
        });
        await interaction.editReply({ embeds: [createSuccessEmbed("O canal foi destrancado.")] });
      } catch (error) {
        await interaction.editReply({ embeds: [createErrorEmbed("Erro ao destrancar o canal.")] });
      }
    }
  },
};
