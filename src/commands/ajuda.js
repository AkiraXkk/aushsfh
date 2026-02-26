const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { createEmbed } = require("../embeds");
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder().setName("ajuda").setDescription("Mostra o painel de ajuda interativo"),
  async execute(interaction) {
    const commands = [...interaction.client.commands.values()];
    
    // Sistema inteligente de categorias baseado nos nomes dos arquivos/comandos
    const categoryMapping = {
      "VIP": ["vip", "vipadmin", "vipbuy"],
      "Economia": ["economy", "shop"],
      "Níveis": ["rank", "leveladmin"],
      "Moderação": ["moderation", "botadmin"],
      "Diversão": ["fun", "dama"],
      "Social": ["social", "family"],
      "Utilidade": ["utility", "ping", "ajuda", "ticket"]
    };
    
    // Mapeia comandos para categorias automaticamente
    const commandsByCategory = {};
    
    // Inicializa categorias
    for (const category of Object.keys(categoryMapping)) {
      commandsByCategory[category] = [];
    }
    
    // Distribui comandos nas categorias
    for (const command of commands) {
      const commandName = command.data.name;
      let categorized = false;
      
      // Verifica em qual categoria o comando se encaixa
      for (const [category, keywords] of Object.entries(categoryMapping)) {
        if (keywords.some(keyword => commandName.includes(keyword))) {
          commandsByCategory[category].push(command);
          categorized = true;
          break;
        }
      }
      
      // Se não encaixou em nenhuma categoria, adiciona em "Outros"
      if (!categorized) {
        if (!commandsByCategory["Outros"]) {
          commandsByCategory["Outros"] = [];
        }
        commandsByCategory["Outros"].push(command);
      }
    }
    
    // Remove categorias vazias
    Object.keys(commandsByCategory).forEach(category => {
      if (commandsByCategory[category].length === 0) {
        delete commandsByCategory[category];
      }
    });

    // Função para criar o menu de seleção
    function createCategoryMenu() {
      const options = Object.keys(commandsByCategory).map(cat => 
        new StringSelectMenuOptionBuilder()
          .setLabel(cat)
          .setValue(cat)
          .setDescription(`${commandsByCategory[cat].length} comandos`)
          .setEmoji(getCategoryEmoji(cat))
      );

      const select = new StringSelectMenuBuilder()
        .setCustomId("help_category_menu")
        .setPlaceholder("Selecione uma categoria")
        .addOptions(options);

      return new ActionRowBuilder().addComponents(select);
    }

    // Função para criar botão de voltar
    function createBackButton() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("help_back")
          .setLabel("🔙 Voltar ao Menu")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // Embed principal
    const mainEmbed = createEmbed({
      title: "🤖 Central de Ajuda",
      description: "Selecione uma categoria no menu abaixo para ver todos os comandos disponíveis.",
      thumbnail: interaction.client.user.displayAvatarURL(),
      fields: [
        { name: "📚 Total de Comandos", value: `${commands.length}`, inline: true },
        { name: "📂 Categorias", value: `${Object.keys(commandsByCategory).length}`, inline: true },
        { name: "💡 Dica", value: "Use os menus abaixo para navegar entre as categorias!", inline: false }
      ],
      color: 0x0099ff,
      footer: { text: `Solicitado por ${interaction.user.username}` }
    });

    const response = await interaction.reply({ 
      embeds: [mainEmbed], 
      components: [createCategoryMenu()], 
      ephemeral: true 
    });

    const collector = response.createMessageComponentCollector({ 
      componentType: ComponentType.StringSelect, 
      time: 60000 
    });

    // Collector para botões
    const buttonCollector = response.createMessageComponentCollector({ 
      componentType: ComponentType.Button, 
      time: 60000 
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "Este menu não é para você!", ephemeral: true });
      }
      
      const selectedCategory = i.values[0];
      const categoryCommands = commandsByCategory[selectedCategory];
      
      // Formata a lista de comandos da categoria
      const commandList = categoryCommands.map(command => {
        const subcommands = command.data.options?.filter(opt => 
          opt.toJSON().type === 1 // SUBCOMMAND
        );
        
        if (subcommands && subcommands.length > 0) {
          const subList = subcommands.map(sub => 
            `> \`/${command.data.name} ${sub.name}\`\n${sub.description}`
          ).join('\n');
          
          return `**${command.data.description}**\n${subList}`;
        } else {
          return `**\`/${command.data.name}\`**\n${command.data.description}`;
        }
      }).join('\n\n');

      const categoryEmbed = createEmbed({
        title: `${getCategoryEmoji(selectedCategory)} ${selectedCategory}`,
        description: commandList || "Nenhum comando encontrado nesta categoria.",
        fields: [
          { name: "📊 Comandos", value: `${categoryCommands.length}`, inline: true },
          { name: "🔍 Navegação", value: "Use o botão abaixo para voltar", inline: true }
        ],
        color: getCategoryColor(selectedCategory),
        footer: { text: `Categoria: ${selectedCategory}` }
      });

      await i.update({ 
        embeds: [categoryEmbed], 
        components: [createBackButton()] 
      });
    });

    buttonCollector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "Este botão não é para você!", ephemeral: true });
      }
      
      if (i.customId === "help_back") {
        await i.update({ 
          embeds: [mainEmbed], 
          components: [createCategoryMenu()] 
        });
      }
    });

    // Limpa collectors após o tempo
    setTimeout(() => {
      collector.stop();
      buttonCollector.stop();
    }, 60000);
  },
};

function getCategoryEmoji(category) {
  const emojis = {
    "VIP": "💎",
    "Economia": "💰",
    "Níveis": "⭐",
    "Moderação": "🛡️",
    "Diversão": "🎉",
    "Social": "👥",
    "Utilidade": "🛠️",
    "Outros": "📂"
  };
  return emojis[category] || "❓";
}

function getCategoryColor(category) {
  const colors = {
    "VIP": 0x9966ff,
    "Economia": 0x33cc33,
    "Níveis": 0xff9900,
    "Moderação": 0xff3333,
    "Diversão": 0xff66cc,
    "Social": 0x00ccff,
    "Utilidade": 0x666666,
    "Outros": 0x999999
  };
  return colors[category] || 0x0099ff;
}
