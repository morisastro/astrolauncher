import { REST, Routes } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

const commands: any[] = [
  {
    name: 'gracz',
    description: 'Informacje o graczu',
    options: [
      {
        type: 3,
        name: 'username',
        description: 'Nazwa użytkownika',
        required: true,
      },
    ],
  },
  {
    name: 'gracze',
    description: 'Lista wszystkich graczy',
  },
  {
    name: 'news',
    description: 'Ostatnie newsy',
  },
  {
    name: 'rangi',
    description: 'Lista rang',
  },
  {
    name: 'admin',
    description: 'Panel administracyjny',
    options: [
      {
        type: 1,
        name: 'user',
        description: 'Szczegółowe info o użytkowniku',
        options: [
          {
            type: 3,
            name: 'username',
            description: 'Nazwa użytkownika',
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: 'setrank',
        description: 'Nadaj rangę użytkownikowi',
        options: [
          {
            type: 3,
            name: 'username',
            description: 'Nazwa użytkownika',
            required: true,
          },
          {
            type: 3,
            name: 'rank',
            description: 'Nazwa rangi',
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: 'setrole',
        description: 'Zmień rolę systemową użytkownika',
        options: [
          {
            type: 3,
            name: 'username',
            description: 'Nazwa użytkownika',
            required: true,
          },
          {
            type: 3,
            name: 'role',
            description: 'Nowa rola (USER/MOD/ADMIN/OWNER)',
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: 'stats',
        description: 'Statystyki launcher\'a',
      },
      {
        type: 1,
        name: 'broadcast',
        description: 'Wyślij ogłoszenie do launcher\'a',
        options: [
          {
            type: 3,
            name: 'message',
            description: 'Treść ogłoszenia',
            required: true,
          },
          {
            type: 3,
            name: 'title',
            description: 'Tytuł ogłoszenia',
            required: false,
          },
        ],
      },
    ],
  },
];

async function main() {
  const rest = new REST({ version: '10' }).setToken(TOKEN!);

  try {
    console.log('Registering commands...');

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID), { body: commands });
      console.log(`Commands registered for guild ${GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID!), { body: commands });
      console.log('Global commands registered');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

main();
