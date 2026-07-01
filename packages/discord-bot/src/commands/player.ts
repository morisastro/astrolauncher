import type { ChatInputCommandInteraction } from 'discord.js';
import { apiGet } from '../lib/api.js';
import { playerInfoEmbed, playerListEmbed, newsListEmbed, ranksListEmbed } from '../embeds/player.js';

export async function handlePlayerLookup(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const username = interaction.options.getString('username', true);

  try {
    const users = await apiGet('/users');
    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      await interaction.editReply(` Nie znaleziono użytkownika **${username}**`);
      return;
    }

    const embed = playerInfoEmbed(user);
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd połączenia z API');
  }
}

export async function handlePlayerList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  try {
    const users = await apiGet('/users');
    const embed = playerListEmbed(users);
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd połączenia z API');
  }
}

export async function handleNews(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  try {
    const news = await apiGet('/news');
    const embed = newsListEmbed(news);
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd połączenia z API');
  }
}

export async function handleRanks(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  try {
    const ranks = await apiGet('/ranks');
    const embed = ranksListEmbed(ranks);
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply(' Błąd połączenia z API');
  }
}
