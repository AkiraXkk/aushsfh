const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createPagination } = require("../utils/pagination");
const { getGuildConfig } = require("../config/guildConfig");
const { createDataStore } = require("../store/dataStore");

const familyStore = createDataStore("families.json");
const couplesStore = createDataStore("couples.json");

function canManageVip(interaction) {
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

async function fetchMember(interaction, userId) {
  if (!interaction.guild) return null;
  return interaction.guild.members.fetch(userId).catch(() => null);
}

async function purgeVipAssets(userId, guild, vipService) {
  const guildId = guild.id;
  const guildConfig = await getGuildConfig(guildId);
  const settings = vipService.getSettings ? (vipService.getSettings(userId) || {}) : {};

  if (settings.roleId) {
    const role = await guild.roles.fetch(settings.roleId).catch(() => null);
    if (role) await role.delete("VIP expirado/removido").catch(() => {});
  }

  if (settings.voiceChannelId) {
    const channel = await guild.channels.fetch(settings.voiceChannelId).catch(() => null);
    if (channel) await channel.delete("VIP expirado/removido").catch(() => {});
  }

  if (vipService.setSettings) {
    await vipService.setSettings(userId, {
      roleId: null,
      roleName: null,
      roleColor: null,
      voiceChannelId: null,
      hoist: false,
      mentionable: false,
      updatedAt: Date.now(),
    }).catch(() => {});
  }

  const families = await familyStore.load();
  const myFamily = Object.values(families).find(f => f.ownerId === userId);

  if (myFamily) {
    if (myFamily.textChannelId) {
      const ch = await guild.channels.fetch(myFamily.textChannelId).catch(() => null);
      if (ch) await ch.delete("VIP expirado/removido").catch(() => {});
    }
    if (myFamily.voiceChannelId) {
      const ch = await guild.channels.fetch(myFamily.voiceChannelId).catch(() => null);
      if (ch) await ch.delete("VIP expirado/removido").catch(() => {});
    }

    if (myFamily.roleId) {
      const familyRole = await guild.roles.fetch(myFamily.roleId).catch(() => null);
      if (familyRole) await familyRole.delete("VIP expirado/removido").catch(() => {});
    }

    delete families[myFamily.id];
    await familyStore.save(families);
  }

  if (guildConfig?.damaRoleId) {
    const couples = await couplesStore.load();
    const guildCouples = couples[guildId] || {};
    let currentDamas = guildCouples[userId];

    if (currentDamas) {
      if (!Array.isArray(currentDamas)) currentDamas = [currentDamas];

      for (const damaId of currentDamas) {
        const damaMember = await guild.members.fetch(damaId).catch(() => null);
        if (damaMember) await damaMember.roles.remove(guildConfig.damaRoleId).catch(() => {});
      }

      delete guildCouples[userId];
      couples[guildId] = guildCouples;
      await couplesStore.save(couples);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Gerencia e consulta VIPs")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Adiciona um usuário ao VIP")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário").setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName("dias")
            .setDescription("Dias de VIP (opcional)")
            .setMinValue(1)
            .setRequired(false)
        )
        .addStringOption((opt) => 
            opt.setName("tier")
               .setDescription("Tier VIP (se não especificar, usa o padrão ou mantém o atual)")
               .setAutocomplete(true) 
               .setRequired(false)
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove um usuário do VIP")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Mostra se alguém é VIP")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário (padrão: você)")),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Lista VIPs cadastrados"))
    .addSubcommand((sub) => sub.setName("panel").setDescription("Abre o painel de controle VIP pessoal")),

  purgeVipAssets,

  async autocomplete(interaction) {
      try {
          const focusedValue = interaction.options.getFocused();
          const vipConfig = interaction.client.services.vipConfig;
          
          if (!vipConfig) {
              return interaction.respond([]);
          }

          const tiers = await vipConfig.getGuildTiers(interaction.guildId);
          if (!tiers) {
              return interaction.respond([]);
          }
          
          const choices = Object.entries(tiers).map(([id, t]) => ({ name: t.name, value: id }));
          const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
          await interaction.respond(filtered.slice(0, 25));
      } catch (error) {
          await interaction.respond([]).catch(() => {});
      }
  },

  async execute(interaction) {
    const vip = interaction.client.services?.vip;
    const vipRole = interaction.client.services?.vipRole;
    if (!vip) {
      await interaction.reply({ content: "Serviço de VIP indisponível.", ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "add" || sub === "remove" || sub === "list") {
      if (!canManageVip(interaction)) {
        await interaction.reply({ content: "Você não tem permissão para isso.", ephemeral: true });
        return;
      }
    }

    if (sub === "panel") {
        const isVip = vip.isVip({ userId: interaction.user.id, member: interaction.member });
        if (!isVip) {
            return interaction.reply({ content: "Você não é VIP para acessar este painel.", ephemeral: true });
        }

        const embed = createEmbed({
            title: "💎 Painel de Controle VIP",
            description: `Olá ${interaction.user}, bem-vindo ao seu painel VIP.\nAqui você pode gerenciar todos os seus benefícios com um clique.`,
            thumbnail: interaction.user.displayAvatarURL(),
            color: 0x9B59B6,
            fields: [
                { name: "👑 Cargo", value: "Personalize nome e cor do seu cargo exclusivo.", inline: true },
                { name: "🔊 Sala Privada", value: "Crie, edite e decore sua sala de voz/texto.", inline: true },
                { name: "🏰 Família", value: "Gerencie sua família (se for dono) ou saia de uma.", inline: true }
            ]
        });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vip_role_manage").setLabel("Gerenciar Cargo").setStyle(ButtonStyle.Primary).setEmoji("👑"),
            new ButtonBuilder().setCustomId("vip_room_manage").setLabel("Gerenciar Sala").setStyle(ButtonStyle.Success).setEmoji("🔊"),
            new ButtonBuilder().setCustomId("vip_family_manage").setLabel("Família").setStyle(ButtonStyle.Secondary).setEmoji("🏰")
        );

        await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
        return;
    }
  },
};
