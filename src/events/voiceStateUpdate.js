const { Events } = require("discord.js");
const { logger } = require("../logger");
const { createDataStore } = require("../store/dataStore");

const voiceXpStore = createDataStore("voiceXp.json");
const VOICE_XP_RATE = 5; // XP por minuto
const MINUTE_MS = 60000;

const voiceSessions = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState, client) {
    // Armazenar referência do client para uso posterior
    if (!clientInstance) clientInstance = client;
    
    // Ignorar bots
    if (newState.member?.user?.bot) return;

    const userId = newState.member.id;
    const guildId = newState.guild.id;

    // Usuário entrou em um canal de voz
    if (!oldState.channelId && newState.channelId) {
      const voiceChannel = newState.channel;
      
      // Verificar se não está mutado ou sozinho
      if (newState.selfMute || newState.selfDeaf) {
        return; // Não dar XP se estiver mutado
      }

      // Verificar se não está sozinho (ignorando bots)
      const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
      if (nonBotMembers.size <= 1) {
        return; // Não dar XP se estiver sozinho
      }

      // Iniciar sessão
      voiceSessions.set(userId, {
        guildId,
        channelId: newState.channelId,
        startTime: Date.now(),
        lastXpTime: Date.now()
      });

      logger.debug({ userId, guildId, channelId: newState.channelId }, "Usuário entrou em canal de voz");
    }
    // Usuário saiu do canal de voz
    else if (oldState.channelId && !newState.channelId) {
      const session = voiceSessions.get(userId);
      if (session) {
        await finalizeVoiceSession(userId, session);
        voiceSessions.delete(userId);
        logger.debug({ userId, guildId: session.guildId }, "Usuário saiu de canal de voz");
      }
    }
    // Usuário mudou de canal ou estado de mute/deafen
    else if (oldState.channelId && newState.channelId) {
      const session = voiceSessions.get(userId);
      
      if (!session) {
        // Se não tinha sessão, criar uma nova se as condições forem favoráveis
        if (!newState.selfMute && !newState.selfDeaf) {
          const voiceChannel = newState.channel;
          const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
          if (nonBotMembers.size > 1) {
            voiceSessions.set(userId, {
              guildId,
              channelId: newState.channelId,
              startTime: Date.now(),
              lastXpTime: Date.now()
            });
          }
        }
      } else {
        // Verificar se ficou mutado/deaf ou sozinho
        const voiceChannel = newState.channel;
        const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
        
        if (newState.selfMute || newState.selfDeaf || nonBotMembers.size <= 1) {
          // Pausar ou finalizar sessão
          await finalizeVoiceSession(userId, session);
          voiceSessions.delete(userId);
        } else if (session.channelId !== newState.channelId) {
          // Mudou de canal, atualizar sessão
          session.channelId = newState.channelId;
        }
      }
    }
  }
};

// Processar XP em intervalos
let clientInstance = null;

async function processVoiceXp() {
  if (!clientInstance) return;
  
  const now = Date.now();
  
  for (const [userId, session] of voiceSessions.entries()) {
    // Verificar se já passou 1 minuto desde o último XP
    if (now - session.lastXpTime >= MINUTE_MS) {
      // Verificar condições atuais
      try {
        const guild = clientInstance.guilds.cache.get(session.guildId);
        if (!guild) continue;
        
        const member = guild.members.cache.get(userId);
        if (!member) continue;
        
        const voiceChannel = member.voice.channel;
        if (!voiceChannel || voiceChannel.id !== session.channelId) continue;
        
        // Verificar se ainda não está mutado e não está sozinho
        if (member.voice.selfMute || member.voice.selfDeaf) continue;
        
        const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
        if (nonBotMembers.size <= 1) continue;
        
        // Adicionar XP
        await addVoiceXp(userId, VOICE_XP_RATE);
        session.lastXpTime = now;
        
        logger.debug({ userId, guildId: session.guildId, xp: VOICE_XP_RATE }, "XP por voz adicionado");
      } catch (error) {
        logger.error({ err: error, userId }, "Erro ao processar XP por voz");
      }
    }
  }
}

// Finalizar sessão e dar XP proporcional
async function finalizeVoiceSession(userId, session) {
  const duration = Date.now() - session.startTime;
  const minutes = Math.floor(duration / MINUTE_MS);
  
  if (minutes > 0) {
    await addVoiceXp(userId, minutes * VOICE_XP_RATE);
    logger.debug({ userId, guildId: session.guildId, minutes, totalXp: minutes * VOICE_XP_RATE }, "Sessão de voz finalizada");
  }
}

// Função para adicionar XP (integrar com sistema existente)
async function addVoiceXp(userId, amount) {
  const levelsStore = createDataStore("levels.json");
  
  await levelsStore.update(userId, (current) => {
    const data = current || { xp: 0, level: 1 };
    const oldLevel = data.level;
    data.xp += amount;
    
    // Calcular novo nível
    const xpNeeded = data.level * 100;
    if (data.xp >= xpNeeded) {
      data.xp -= xpNeeded;
      data.level += 1;
      
      // Aqui poderia ser integrado com o sistema de notificação de level up
      logger.info({ userId, oldLevel, newLevel: data.level }, "Usuário subiu de nível por voz");
    }
    
    return data;
  });
}

// Iniciar processamento de XP
setInterval(processVoiceXp, MINUTE_MS);
