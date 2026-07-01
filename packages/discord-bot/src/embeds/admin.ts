import { EmbedBuilder } from 'discord.js';

export function adminUserEmbed(user: any): EmbedBuilder {
  const rankColor = user.rank?.color || '#58a6ff';
  const embed = new EmbedBuilder()
    .setColor(parseInt(rankColor.replace('#', ''), 16))
    .setTitle(`🔧 ADMIN: ${user.username}`)
    .setThumbnail(user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png')
    .addFields(
      { name: 'ID', value: `\`${user.id}\``, inline: false },
      { name: 'Username', value: user.username, inline: true },
      { name: 'Email', value: `||${user.email}||`, inline: true },
      { name: 'Rola systemowa', value: `\`${user.role}\``, inline: true },
      {
        name: 'Ranga',
        value: user.rank
          ? `${user.rank.icon || ''} **${user.rank.displayName}** (\`${user.rank.name}\`)`
          : '❌ Brak',
        inline: true,
      },
      {
        name: 'Kolor rangi',
        value: user.rank?.color || '❌',
        inline: true,
      },
      {
        name: 'Zarejestrowany',
        value: `<t:${Math.floor(new Date(user.createdAt).getTime() / 1000)}:F>`,
        inline: true,
      },
    )
    .setFooter({ text: 'Astro Admin Panel' })
    .setTimestamp();

  if (user.rank?.icon) {
    embed.setImage(user.rank.icon);
  }

  return embed;
}

export function adminStatsEmbed(stats: {
  users: number;
  news: number;
  ranks: number;
  versions: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x58a6ff)
    .setTitle('📊 Statystyki Astro Launcher')
    .addFields(
      { name: '👤 Użytkownicy', value: String(stats.users), inline: true },
      { name: '📰 Newsy', value: String(stats.news), inline: true },
      { name: '🏅 Rangi', value: String(stats.ranks), inline: true },
      { name: '🎮 Wersje MC', value: String(stats.versions), inline: true },
    )
    .setFooter({ text: 'Astro Admin Panel' })
    .setTimestamp();

  return embed;
}

export function adminActionEmbed(
  action: string,
  target: string,
  result: string,
  success: boolean,
): EmbedBuilder {
  const color = success ? 0x3fb950 : 0xf85149;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(success ? '✅ Akcja wykonana' : '❌ Błąd')
    .addFields(
      { name: 'Akcja', value: `\`${action}\``, inline: true },
      { name: 'Cel', value: target, inline: true },
      { name: 'Wynik', value: result, inline: false },
    )
    .setFooter({ text: 'Astro Admin Panel' })
    .setTimestamp();

  return embed;
}
