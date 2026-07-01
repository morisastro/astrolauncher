import { EmbedBuilder } from 'discord.js';

export function playerInfoEmbed(user: any): EmbedBuilder {
  const rankColor = user.rank?.color || '#58a6ff';
  const embed = new EmbedBuilder()
    .setColor(parseInt(rankColor.replace('#', ''), 16))
    .setTitle(`👤 ${user.username}`)
    .setThumbnail(user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png')
    .addFields(
      {
        name: 'Ranga',
        value: user.rank
          ? `${user.rank.icon ? user.rank.icon + ' ' : ''}**${user.rank.displayName}**`
          : 'Brak',
        inline: true,
      },
      {
        name: 'Rola',
        value: `\`${user.role}\``,
        inline: true,
      },
      {
        name: 'Email',
        value: `||${user.email}||`,
        inline: false,
      },
      {
        name: 'Zarejestrowany',
        value: `<t:${Math.floor(new Date(user.createdAt).getTime() / 1000)}:D>`,
        inline: true,
      },
    )
    .setFooter({ text: 'Astro Launcher' })
    .setTimestamp();

  return embed;
}

export function playerListEmbed(users: any[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x58a6ff)
    .setTitle(`📋 Użytkownicy (${users.length})`)
    .setDescription(
      users
        .slice(0, 25)
        .map(
          (u) =>
            `${u.rank?.icon || '❓'} **${u.username}** — ${u.rank?.displayName || 'Brak rangi'} \`[${u.role}]\``,
        )
        .join('\n') || 'Brak użytkowników',
    )
    .setFooter({ text: 'Astro Launcher' })
    .setTimestamp();

  return embed;
}

export function newsListEmbed(news: any[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x3fb950)
    .setTitle('📰 Ostatnie newsy')
    .setDescription(
      news
        .slice(0, 5)
        .map(
          (n) =>
            `**${n.title}**\n${n.content.slice(0, 200)}${n.content.length > 200 ? '...' : ''}\n— ${n.author.username} (<t:${Math.floor(new Date(n.createdAt).getTime() / 1000)}:R>)`,
        )
        .join('\n\n') || 'Brak newsów',
    )
    .setFooter({ text: 'Astro Launcher' })
    .setTimestamp();

  return embed;
}

export function ranksListEmbed(ranks: any[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xd29922)
    .setTitle('🏅 Rangi')
    .setDescription(
      ranks
        .map(
          (r) =>
            `${r.icon || ''} **${r.displayName}** — \`${r.name}\` — priorytet: ${r.priority}`,
        )
        .join('\n') || 'Brak rang',
    )
    .setFooter({ text: 'Astro Launcher' })
    .setTimestamp();

  return embed;
}
