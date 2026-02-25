const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Painel e informações do sistema VIP")
    .addSubcommand(sub => sub.setName("panel").setDescription("Abre o seu painel de controle VIP pessoal"))
    .addSubcommand(sub => sub.setName("status").setDescription("Verifica o tempo restante do seu VIP"))
    .addSubcommand(sub => sub.setName("lista").setDescription("Lista todos os membros VIP do servidor")),

  async execute(interaction) {
    const vipService = interaction.client.services.vip;
    const sub = interaction.options.getSubcommand();

    // 1. TRAVA DE SEGURANÇA (Solicitada por você)
    const allVips = vipService.listVipIds();
    if (!allVips || allVips.length === 0) {
      return interaction.reply({ 
        embeds: [createErrorEmbed("O sistema VIP não possui registros no momento. O painel está desativado.")], 
        ephemeral: true 
      });
    }

    // 2. LÓGICA DO PAINEL (Unificando o myvip.js aqui)
    if (sub === "panel") {
      const isVip = vipService.isVip({ userId: interaction.user.id, member: interaction.member });
      
      if (!isVip) {
        return interaction.reply({ 
          content: "Você não possui um plano VIP ativo para acessar as configurações.", 
          ephemeral: true 
        });
      }

      const embed = createEmbed({
        title: "💎 Seu Painel VIP",
        description: "Seja bem-vindo! Utilize os botões abaixo para gerenciar seus benefícios.",
        color: 0x9B59B6,
        fields: [
          { name: "👑 Personalização", value: "Altere nome e cor do seu cargo.", inline: true },
          { name: "🔊 Canais", value: "Gerencie sua sala de voz e texto.", inline: true },
          { name: "🏰 Família", value: "Configurações da sua família VIP.", inline: true }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vip_role_manage").setLabel("Meu Cargo").setStyle(ButtonStyle.Primary).setEmoji("👑"),
        new ButtonBuilder().setCustomId("vip_room_manage").setLabel("Minha Sala").setStyle(ButtonStyle.Success).setEmoji("🔊"),
        new ButtonBuilder().setCustomId("vip_family_manage").setLabel("Família").setStyle(ButtonStyle.Secondary).setEmoji("🏰")
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // 3. STATUS (Quanto tempo resta)
    if (sub === "status") {
      const entry = vipService.getVip(interaction.user.id);
      if (!entry) return interaction.reply({ content: "Você não é um membro VIP.", ephemeral: true });

      const expiration = entry.expiresAt ? `<t:${Math.floor(entry.expiresAt / 1000)}:R>` : "Vitalício";
      return interaction.reply({ 
        content: `Seu VIP expira em: ${expiration}`, 
        ephemeral: true 
      });
    }

    // 4. LISTA
    if (sub === "lista") {
      const lista = allVips.map(id => `<@${id}>`).join(", ");
      return interaction.reply({ 
        embeds: [createEmbed({ title: "👥 Membros VIP", description: lista })], 
        ephemeral: true 
      });
    }
  }
};
