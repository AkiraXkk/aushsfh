const { Events } = require("discord.js");

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const levelsCommand = client.commands.get("rank");
    if (!levelsCommand?.addXpForMessage) return;

    try {
      const membro = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
      if (!membro) return;

      const { subiuNivel, novoNivel, nivelAnterior } = await levelsCommand.addXpForMessage(membro);
      if (subiuNivel && levelsCommand.applyLevelRoles) {
        await levelsCommand.applyLevelRoles(membro, nivelAnterior, novoNivel);
        await message.channel.send(`🎉 Parabéns ${message.author}! Você subiu para o nível **${novoNivel}**!`);
      }
    } catch (_) {}
  },
};
