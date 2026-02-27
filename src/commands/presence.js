const { SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require("discord.js");
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require("../embeds");

function parseActivityType(typeStr) {
  if (!typeStr) return null;
  const v = String(typeStr).trim().toLowerCase();
  const map = {
    playing: ActivityType.Playing,
    streaming: ActivityType.Streaming,
    listening: ActivityType.Listening,
    watching: ActivityType.Watching,
    competing: ActivityType.Competing,
  };
  return map[v] ?? null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("presence")
    .setDescription("Gerencia o Rich Presence do bot (somente DM)")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Define o status e atividade do bot")
        .addStringOption((opt) => opt.setName("text").setDescription("Texto da atividade").setRequired(true))
        .addStringOption((opt) => opt.setName("status").setDescription("online|idle|dnd|invisible").setRequired(false))
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("playing|streaming|listening|watching|competing")
            .setRequired(false)
        )
        .addStringOption((opt) => opt.setName("url").setDescription("URL (apenas streaming)").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("clear").setDescription("Remove o presence salvo (volta ao padrão)") )
    .addSubcommand((sub) => sub.setName("view").setDescription("Mostra o presence salvo") ),

  async execute(interaction) {
    // Somente dono (por segurança)
    const ownerId = process.env.OWNER_ID;
    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ embeds: [createErrorEmbed("Apenas o dono do bot pode usar isso.")], ephemeral: true });
    }
    if (!ownerId) {
      return interaction.reply({ embeds: [createErrorEmbed("OWNER_ID não configurado no .env.")], ephemeral: true });
    }

    const presenceService = interaction.client.services?.presence;
    if (!presenceService) {
      return interaction.reply({ embeds: [createErrorEmbed("Serviço de presence indisponível.")], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "view") {
      const saved = await presenceService.getPresence();
      if (!saved) {
        return interaction.reply({ embeds: [createEmbed({ title: "Presence", description: "Nenhum presence salvo.", color: 0x95a5a6 })], ephemeral: true });
      }

      return interaction.reply({
        embeds: [
          createEmbed({
            title: "Presence salvo",
            fields: [
              { name: "Status", value: String(saved.status || "(padrão)"), inline: true },
              { name: "Type", value: String(saved.activity?.type ?? "(padrão)"), inline: true },
              { name: "Texto", value: String(saved.activity?.name || "(vazio)"), inline: false },
              { name: "URL", value: String(saved.activity?.url || "(nenhuma)"), inline: false },
            ],
            color: 0x3498db,
          }),
        ],
        ephemeral: true,
      });
    }

    if (sub === "clear") {
      await presenceService.clearPresence();
      // Não mexer no status atual do bot, apenas remove o persistido
      return interaction.reply({ embeds: [createSuccessEmbed("Presence salvo removido.")], ephemeral: true });
    }

    if (sub === "set") {
      const status = interaction.options.getString("status");
      const typeStr = interaction.options.getString("type");
      const text = interaction.options.getString("text");
      const url = interaction.options.getString("url");

      const type = parseActivityType(typeStr) ?? ActivityType.Playing;

      const next = await presenceService.setPresence({
        status: status || "online",
        activity: {
          type,
          name: text,
          url: url || null,
        },
      });

      await presenceService.applyPresence(interaction.client).catch(() => {});

      return interaction.reply({
        embeds: [createSuccessEmbed(`Presence atualizado e salvo. Atividade: **${next.activity?.name || ""}**`)],
        ephemeral: true,
      });
    }
  },
};
