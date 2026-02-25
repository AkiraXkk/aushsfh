const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");
const { getGuildConfig } = require("../config/guildConfig");

const familyStore = createDataStore("families.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("family")
    .setDescription("Sistema de Família VIP")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Cria uma nova família (Requer VIP)")
        .addStringOption((opt) => opt.setName("nome").setDescription("Nome da família").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Deleta sua família")
    )
    .addSubcommand((sub) =>
      sub
        .setName("invite")
        .setDescription("Convida um membro para a família")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário a convidar").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Remove um membro da família")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário a remover").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("leave")
        .setDescription("Sai da família atual")
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Mostra informações da família")
    )
    .addSubcommandGroup((group) =>
        group
            .setName("config")
            .setDescription("Personaliza sua família")
            .addSubcommand((sub) =>
                sub.setName("rename").setDescription("Renomeia a família").addStringOption(opt => opt.setName("novo_nome").setDescription("Novo nome").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("color").setDescription("Altera a cor do cargo").addStringOption(opt => opt.setName("cor").setDescription("Cor Hex (ex: #FF0000)").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("decorate").setDescription("Decora os canais com templates")
            )
    )
    .addSubcommand((sub) =>
        sub.setName("promote").setDescription("Promove um membro a admin da família").addUserOption(opt => opt.setName("usuario").setDescription("Membro a promover").setRequired(true))
    )
    .addSubcommand((sub) =>
        sub.setName("demote").setDescription("Rebaixa um admin da família").addUserOption(opt => opt.setName("usuario").setDescription("Admin a rebaixar").setRequired(true))
    )
    .addSubcommand((sub) =>
        sub.setName("list").setDescription("Lista o ranking das maiores famílias")
    )
    .addSubcommand((sub) =>
        sub.setName("transfer").setDescription("Transfere a liderança da família").addUserOption(opt => opt.setName("novo_lider").setDescription("Novo dono").setRequired(true))
    )
    .addSubcommandGroup((group) =>
        group.setName("bank").setDescription("Banco da Família")
            .addSubcommand(sub => sub.setName("deposit").setDescription("Deposita moedas").addIntegerOption(opt => opt.setName("quantia").setDescription("Valor").setMinValue(1).setRequired(true)))
            .addSubcommand(sub => sub.setName("withdraw").setDescription("Saca moedas (Dono/Admin)").addIntegerOption(opt => opt.setName("quantia").setDescription("Valor").setMinValue(1).setRequired(true)))
            .addSubcommand(sub => sub.setName("balance").setDescription("Ver saldo"))
    )
    .addSubcommand((sub) =>
        sub.setName("upgrade").setDescription("Compra slot extra de membro")
    )
    .addSubcommand((sub) =>
        sub.setName("panel").setDescription("Abre o painel de controle da família")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();
    const families = await familyStore.load();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const economyService = interaction.client.services.economy;

    const userFamily = Object.values(families).find(f => f.members.includes(userId));

    if (sub === "panel") {
        if (!userFamily) return interaction.reply({ embeds: [createErrorEmbed("Você não tem família!")], ephemeral: true });

        const embed = createEmbed({
            title: `🏰 Painel da Família: ${userFamily.name}`,
            description: `Gerencie sua família com facilidade.\nCargo: <@&${userFamily.roleId || "Nenhum"}>\nSaldo: **${userFamily.bank || 0} 🪙**`,
            color: 0x9B59B6
        });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("family_btn_info").setLabel("Info").setStyle(ButtonStyle.Primary).setEmoji("ℹ️"),
            new ButtonBuilder().setCustomId("family_btn_members").setLabel("Membros").setStyle(ButtonStyle.Secondary).setEmoji("👥"),
            new ButtonBuilder().setCustomId("family_btn_bank").setLabel("Banco").setStyle(ButtonStyle.Success).setEmoji("🏦"),
            new ButtonBuilder().setCustomId("family_btn_upgrade").setLabel("Upgrade").setStyle(ButtonStyle.Success).setEmoji("⬆️")
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("family_btn_invite_menu").setLabel("Convidar").setStyle(ButtonStyle.Primary).setEmoji("📩"),
            new ButtonBuilder().setCustomId("family_btn_leave").setLabel("Sair").setStyle(ButtonStyle.Danger).setEmoji("🚪")
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        return;
    }

    if (group === "bank") {
        if (!userFamily) return interaction.reply({ embeds: [createErrorEmbed("Você não tem família!")], ephemeral: true });

        if (sub === "balance") {
            await interaction.reply({ embeds: [createEmbed({ 
                title: `🏦 Banco da Família ${userFamily.name}`,
                description: `Saldo: **${userFamily.bank || 0} 🪙**`,
                color: 0xF1C40F
            })] });
        }

        if (sub === "deposit") {
            const amount = interaction.options.getInteger("quantia");
            const balance = await economyService.getBalance(userId);
            if ((balance.coins || 0) < amount) {
                return interaction.reply({ embeds: [createErrorEmbed(`Você não tem **${amount} 🪙**.`)] });
            }
            await economyService.removeCoins(userId, amount);
            userFamily.bank = (userFamily.bank || 0) + amount;
            await familyStore.save(families);
            await interaction.reply({ embeds: [createSuccessEmbed(`Você depositou **${amount} 🪙** no cofre da família.`)] });
        }

        if (sub === "withdraw") {
            const isOwner = userFamily.ownerId === userId;
            const isAdmin = userFamily.admins && userFamily.admins.includes(userId);
            if (!isOwner && !isAdmin) {
                return interaction.reply({ embeds: [createErrorEmbed("Apenas Dono e Admins podem sacar.")] });
            }
            const amount = interaction.options.getInteger("quantia");
            if ((userFamily.bank || 0) < amount) {
                return interaction.reply({ embeds: [createErrorEmbed(`A família não tem **${amount} 🪙** (Saldo: ${userFamily.bank || 0}).`)] });
            }
            userFamily.bank -= amount;
            await familyStore.save(families);
            await economyService.addCoins(userId, amount);
            await interaction.reply({ embeds: [createSuccessEmbed(`Você sacou **${amount} 🪙** do cofre da família.`)] });
        }
        return;
    }
  }
};
