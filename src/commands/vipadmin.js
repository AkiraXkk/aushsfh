const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Administração total do sistema VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("tier")
        .setDescription("Configura as regras de um plano VIP")
        .addStringOption((o) => o.setName("id").setDescription("ID único (ex: gold)").setRequired(true))
        .addStringOption((o) => o.setName("nome").setDescription("Nome de exibição").setRequired(true))
        .addNumberOption((o) => o.setName("preco").setDescription("Preço").setRequired(true))
        .addRoleOption((o) => o.setName("cargo_principal").setDescription("Cargo fixo do cliente").setRequired(true))
        .addIntegerOption((o) => o.setName("dias").setDescription("Duração em dias (0 = Permanente)").setRequired(true))
        .addIntegerOption((o) => o.setName("limite_damas").setDescription("Qtd de Primeiras Damas permitidas").setRequired(true))
        .addIntegerOption((o) => o.setName("limite_membros_cargo").setDescription("Qtd de membros no 2º cargo").setRequired(true))
        .addIntegerOption((o) => o.setName("limite_membros_familia").setDescription("Qtd de membros na família").setRequired(true))
        .addBooleanOption((o) => o.setName("familia").setDescription("Pode criar família?").setRequired(true))
        .addBooleanOption((o) => o.setName("duplo_cargo").setDescription("Pode criar 2º cargo personalizável?").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription("Configura cargos de separador e categorias")
        .addRoleOption((o) => o.setName("cargo_base").setDescription("Cargo VIP principal"))
        .addChannelOption((o) =>
          o.setName("categoria_vip").setDescription("Categoria padrão dos canais VIP").addChannelTypes(ChannelType.GuildCategory)
        )
        .addChannelOption((o) =>
          o.setName("categoria_familia").setDescription("Categoria padrão das famílias").addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption((o) => o.setName("sep_vip").setDescription("Separador de cargos VIP"))
        .addRoleOption((o) => o.setName("sep_familia").setDescription("Separador de cargos de Família"))
        .addRoleOption((o) => o.setName("sep_personalizados").setDescription("Separador de cargos Personalizados"))
    )
    .addSubcommand((s) =>
      s
        .setName("delete-family")
        .setDescription("Força a exclusão da família de um usuário")
        .addUserOption((o) => o.setName("usuario").setDescription("Dono da família").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("delete-vip-assets")
        .setDescription("Força a limpeza de cargos/canais VIP de um usuário")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuário alvo").setRequired(true))
    ),

  async execute(interaction) {
    const vipService = interaction.client.services.vip;
    const familyService = interaction.client.services.family;
    const vipRoleManager = interaction.client.services.vipRole;
    const vipChannelManager = interaction.client.services.vipChannel;
    const sub = interaction.options.getSubcommand();

    if (sub === "tier") {
      const id = interaction.options.getString("id");
      const config = {
        name: interaction.options.getString("nome"),
        price: interaction.options.getNumber("preco"),
        roleId: interaction.options.getRole("cargo_principal").id,
        days: interaction.options.getInteger("dias"),
        maxDamas: interaction.options.getInteger("limite_damas"),
        maxSecondRoleMembers: interaction.options.getInteger("limite_membros_cargo"),
        maxFamilyMembers: interaction.options.getInteger("limite_membros_familia"),
        canFamily: interaction.options.getBoolean("familia"),
        hasSecondRole: interaction.options.getBoolean("duplo_cargo"),
      };
      try {
        await vipService.updateTier(interaction.guildId, id, config);
        const texto = [
          `**Plano ${config.name} configurado.**`,
          `Preço: \`R$ ${config.price}\` | Duração: ${config.days === 0 ? "♾️ Permanente" : config.days + " dias"}`,
          `Damas: \`${config.maxDamas}\` • 2º Cargo: até \`${config.maxSecondRoleMembers}\` membros • Família: até \`${config.maxFamilyMembers}\` membros`,
          `Recursos: Família ${config.canFamily ? "✅" : "❌"} • 2º Cargo ${config.hasSecondRole ? "✅" : "❌"}`,
        ].join("\n");
        return interaction.reply({ embeds: [createSuccessEmbed(texto)], ephemeral: true });
      } catch (err) {
        return interaction.reply({ embeds: [createErrorEmbed("Falha ao salvar tier.")], ephemeral: true });
      }
    }

    if (sub === "setup") {
      const cargoBase = interaction.options.getRole("cargo_base");
      const categoriaVip = interaction.options.getChannel("categoria_vip");
      const categoriaFamilia = interaction.options.getChannel("categoria_familia");
      const sepVip = interaction.options.getRole("sep_vip");
      const sepFamilia = interaction.options.getRole("sep_familia");
      const sepPersonalizados = interaction.options.getRole("sep_personalizados");

      const patch = {};
      if (cargoBase) patch.vipRoleId = cargoBase.id;
      if (categoriaVip) patch.vipCategoryId = categoriaVip.id;
      if (categoriaFamilia) patch.familyCategoryId = categoriaFamilia.id;
      if (sepVip) patch.vipSeparatorRoleId = sepVip.id;
      if (sepFamilia) patch.familySeparatorRoleId = sepFamilia.id;
      if (sepPersonalizados) patch.personalSeparatorRoleId = sepPersonalizados.id;
      if (Object.keys(patch).length === 0) {
        return interaction.reply({
          embeds: [createErrorEmbed("Informe ao menos um: cargo base ou categoria.")],
          ephemeral: true,
        });
      }
      try {
        await vipService.setGuildConfig(interaction.guildId, patch);
        return interaction.reply({ embeds: [createSuccessEmbed("Setup VIP atualizado.")], ephemeral: true });
      } catch (err) {
        return interaction.reply({ embeds: [createErrorEmbed("Falha ao salvar setup.")], ephemeral: true });
      }
    }

    if (sub === "delete-family") {
      const alvo = interaction.options.getUser("usuario");
      if (!familyService) {
        return interaction.reply({ embeds: [createErrorEmbed("Serviço de família indisponível.")], ephemeral: true });
      }
      try {
        const ok = await familyService.deleteFamily(interaction.guild, alvo.id);
        if (!ok) {
          return interaction.reply({ embeds: [createErrorEmbed("Família não encontrada para este usuário.")], ephemeral: true });
        }
        return interaction.reply({ embeds: [createSuccessEmbed(`Família de ${alvo} excluída.`)], ephemeral: true });
      } catch (err) {
        return interaction.reply({ embeds: [createErrorEmbed("Erro ao excluir família.")], ephemeral: true });
      }
    }

    if (sub === "delete-vip-assets") {
      const alvo = interaction.options.getUser("usuario");
      const guildId = interaction.guildId;
      const member = await interaction.guild.members.fetch(alvo.id).catch(() => null);
      const entry = vipService.getVip(alvo.id);

      try {
        if (vipRoleManager) {
          await vipRoleManager.deletePersonalRole(alvo.id, { guildId }).catch(() => {});
        }
        if (vipChannelManager) {
          await vipChannelManager.deleteVipChannels(alvo.id, { guildId }).catch(() => {});
        }
        if (entry) {
          await vipService.removeVip(alvo.id).catch(() => {});
        }
        if (member) {
          const vipConfig = vipService.getGuildConfig(guildId);
          if (vipConfig?.vipRoleId) {
            await member.roles.remove(vipConfig.vipRoleId).catch(() => {});
          }
          if (entry?.tierId) {
            await member.roles.remove(entry.tierId).catch(() => {});
          }
        }
        if (familyService) {
          await familyService.deleteFamily(interaction.guild, alvo.id).catch(() => {});
        }
        return interaction.reply({ embeds: [createSuccessEmbed(`Ativos VIP de ${alvo} limpos.`)], ephemeral: true });
      } catch (err) {
        return interaction.reply({ embeds: [createErrorEmbed("Erro ao limpar ativos VIP.")], ephemeral: true });
      }
    }
  },
};
