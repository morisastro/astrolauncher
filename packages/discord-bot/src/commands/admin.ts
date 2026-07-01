import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { apiGet, apiPatch, apiPost } from '../lib/api.js';
import { adminUserEmbed, adminStatsEmbed, adminActionEmbed } from '../embeds/admin.js';

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || '';

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!ADMIN_ROLE_ID) return true;
  const member = interaction.member;
  if (!member) return false;
  if ('roles' in member && 'cache' in (member as GuildMember).roles) {
    return (member as GuildMember).roles.cache.has(ADMIN_ROLE_ID);
  }
  return false;
}

export async function handleAdminUser(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isAdmin(interaction)) {
    await interaction.editReply(' Brak uprawnień');
    return;
  }

  const username = interaction.options.getString('username', true);

  try {
    const users = await apiGet('/users');
    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      await interaction.editReply(` Nie znaleziono **${username}**`);
      return;
    }

    const embed = adminUserEmbed(user);
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd API');
  }
}

export async function handleAdminSetRank(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isAdmin(interaction)) {
    await interaction.editReply(' Brak uprawnień');
    return;
  }

  const username = interaction.options.getString('username', true);
  const rankName = interaction.options.getString('rank', true);

  try {
    const [users, ranks] = await Promise.all([apiGet('/users'), apiGet('/ranks')]);
    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
    const rank = ranks.find((r: any) => r.name.toLowerCase() === rankName.toLowerCase());

    if (!user) {
      await interaction.editReply(` Nie znaleziono użytkownika **${username}**`);
      return;
    }
    if (!rank) {
      await interaction.editReply(` Nie znaleziono rangi **${rankName}**`);
      return;
    }

    await apiPatch(`/users/${user.id}/rank`, { rankId: rank.id });

    const embed = adminActionEmbed(
      'Nadanie rangi',
      `${user.username} -> ${rank.displayName}`,
      `Ranga **${rank.displayName}** nadana użytkownikowi **${user.username}**`,
      true,
    );
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd API');
  }
}

export async function handleAdminSetRole(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isAdmin(interaction)) {
    await interaction.editReply(' Brak uprawnień');
    return;
  }

  const username = interaction.options.getString('username', true);
  const role = interaction.options.getString('role', true);
  const validRoles = ['USER', 'MOD', 'ADMIN', 'OWNER'];

  if (!validRoles.includes(role)) {
    await interaction.editReply(` Nieprawidłowa rola. Dozwolone: ${validRoles.join(', ')}`);
    return;
  }

  try {
    const users = await apiGet('/users');
    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      await interaction.editReply(` Nie znaleziono **${username}**`);
      return;
    }

    await apiPatch(`/users/${user.id}/role`, { role });

    const embed = adminActionEmbed(
      'Zmiana roli',
      `${user.username} -> ${role}`,
      `Rola **${role}** nadana użytkownikowi **${user.username}**`,
      true,
    );
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd API');
  }
}

export async function handleAdminStats(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isAdmin(interaction)) {
    await interaction.editReply(' Brak uprawnień');
    return;
  }

  try {
    const [users, news, ranks, versions] = await Promise.all([
      apiGet('/users'),
      apiGet('/news'),
      apiGet('/ranks'),
      apiGet('/versions'),
    ]);

    const embed = adminStatsEmbed({
      users: users.length,
      news: news.length,
      ranks: ranks.length,
      versions: versions.length,
    });
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd API');
  }
}

export async function handleAdminBroadcast(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isAdmin(interaction)) {
    await interaction.editReply(' Brak uprawnień');
    return;
  }

  const message = interaction.options.getString('message', true);
  const title = interaction.options.getString('title') || ' Ogłoszenie';

  try {
    await apiPost('/news', {
      title,
      content: message,
      published: true,
    });

    const embed = adminActionEmbed(
      'Broadcast',
      'News',
      `Opublikowano news: **${title}**`,
      true,
    );
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd API');
  }
}
