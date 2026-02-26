const { Events } = require("discord.js");
const { logger } = require("../logger");
const { getGuildConfig } = require("../config/guildConfig");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Button Handler
    if (interaction.isButton()) {
        const commands = client.commands.values();
        for (const command of commands) {
            if (typeof command.handleButton === "function") {
                try {
                    await command.handleButton(interaction);
                    if (interaction.replied || interaction.deferred) return;
                } catch (error) {
                    logger.error({ err: error, command: command.data.name }, "Erro ao processar botão");
                }
            }
        }
        return;
    }

    // Modal Submit Handler
    if (interaction.isModalSubmit()) {
        const commands = client.commands.values();
        for (const command of commands) {
            if (typeof command.handleModal === "function") {
                try {
                    await command.handleModal(interaction);
                    if (interaction.replied || interaction.deferred) return;
                } catch (error) {
                    logger.error({ err: error, command: command.data.name }, "Erro ao processar modal");
                }
            }
        }
        return;
    }

    // Select Menu Handler (String, User, Role, Channel, Mentionable)
    if (interaction.isAnySelectMenu()) {
        const commands = client.commands.values();
        for (const command of commands) {
            if (typeof command.handleSelectMenu === "function") {
                try {
                    await command.handleSelectMenu(interaction);
                    if (interaction.replied || interaction.deferred) return;
                } catch (error) {
                    logger.error({ err: error, command: command.data.name }, "Erro ao processar menu de seleção");
                }
            }
        }
        return;
    }
    
    // Autocomplete Handler
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            logger.error({ err: error, command: interaction.commandName }, "Erro no Autocomplete");
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      if (interaction.guild) {
        const guildConfig = await getGuildConfig(interaction.guild.id);
        const bypassRoles = guildConfig.commandBypassRoleIds || [];
        const hasBypass =
          bypassRoles.length > 0 &&
          interaction.member?.roles?.cache?.some((r) => bypassRoles.includes(r.id));

        if (!hasBypass) {
          const nome = interaction.commandName;
          const canalId = interaction.channelId;

          if (nome === "fun") {
            const permitidos = guildConfig.allowedFunChannels || [];
            if (permitidos.length > 0 && !permitidos.includes(canalId)) {
              return interaction.reply({
                content: "Este comando só pode ser usado nos canais de diversão configurados.",
                ephemeral: true,
              });
            }
          }

          if (nome === "utility") {
            const permitidos = guildConfig.allowedUtilityChannels || [];
            if (permitidos.length > 0 && !permitidos.includes(canalId)) {
              return interaction.reply({
                content: "Este comando só pode ser usado nos canais de utilidade configurados.",
                ephemeral: true,
              });
            }
          }
        }
      }

      await command.execute(interaction);
    } catch (error) {
      logger.error({ err: error, command: interaction.commandName }, "Erro ao executar comando");

      const payload = { content: "Ocorreu um erro ao executar esse comando.", ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
