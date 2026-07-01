import { Client, Events, GatewayIntentBits, type ChatInputCommandInteraction } from 'discord.js';
import { handlePlayerLookup, handlePlayerList, handleNews, handleRanks } from './commands/player.js';
import {
  handleAdminUser,
  handleAdminSetRank,
  handleAdminSetRole,
  handleAdminStats,
  handleAdminBroadcast,
} from './commands/admin.js';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(` Astro Bot logged in as ${client.user?.tag}`);
  client.user?.setActivity('Astro Launcher', { type: 3 });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction as ChatInputCommandInteraction;

  try {
    switch (cmd.commandName) {
      case 'gracz':
        await handlePlayerLookup(cmd);
        break;
      case 'gracze':
        await handlePlayerList(cmd);
        break;
      case 'news':
        await handleNews(cmd);
        break;
      case 'rangi':
        await handleRanks(cmd);
        break;
      case 'admin': {
        const sub = cmd.options.getSubcommand();
        switch (sub) {
          case 'user':
            await handleAdminUser(cmd);
            break;
          case 'setrank':
            await handleAdminSetRank(cmd);
            break;
          case 'setrole':
            await handleAdminSetRole(cmd);
            break;
          case 'stats':
            await handleAdminStats(cmd);
            break;
          case 'broadcast':
            await handleAdminBroadcast(cmd);
            break;
        }
        break;
      }
    }
  } catch (err) {
    console.error('Command error:', err);
    try {
      if (cmd.deferred) {
        await cmd.editReply(' Wystąpił nieoczekiwany błąd');
      } else {
        await cmd.reply({ content: ' Wystąpił nieoczekiwany błąd', ephemeral: true });
      }
    } catch {}
  }
});

client.login(TOKEN);
