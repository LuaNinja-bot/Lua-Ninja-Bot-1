'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const { isOwnerOrAdmin } = require('../modules/permissions');
const { getAllAPIStatus } = require('../modules/apiClient');
const config = require('../config');

async function handleConfig(interaction, client) {
  const userId = interaction.user.id;
  const member = interaction.member || {};

  if (!isOwnerOrAdmin(member, userId)) {
    return interaction.reply({ content: '❌ Acceso denegado. Solo Owner/Admin.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('config_modal')
    .setTitle('⚙️ Configuración de API - Bot Lua Ninja');

  const apiKeyInput = new TextInputBuilder()
    .setCustomId('new_api_key')
    .setLabel('Nueva API Key (dejar vacío = sin cambio)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('sk-or-v1-...');

  const baseUrlInput = new TextInputBuilder()
    .setCustomId('new_base_url')
    .setLabel('Nueva Base URL')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('https://openrouter.ai/api/v1');

  const modelInput = new TextInputBuilder()
    .setCustomId('new_model')
    .setLabel('Nuevo Modelo (Primary Engineer)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('meta-llama/llama-3.1-405b-instruct');

  modal.addComponents(
    new ActionRowBuilder().addComponents(apiKeyInput),
    new ActionRowBuilder().addComponents(baseUrlInput),
    new ActionRowBuilder().addComponents(modelInput),
  );

  await interaction.showModal(modal);
}

async function handleConfigModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const newKey = interaction.fields.getTextInputValue('new_api_key').trim();
  const newUrl = interaction.fields.getTextInputValue('new_base_url').trim();
  const newModel = interaction.fields.getTextInputValue('new_model').trim();

  const changes = [];
  if (newKey) {
    process.env.OPENROUTER_API_KEY = newKey;
    config.apis.primary.key = newKey;
    changes.push('✅ API Key actualizada');
  }
  if (newUrl) {
    process.env.OPENROUTER_BASE_URL = newUrl;
    config.apis.primary.baseUrl = newUrl;
    changes.push(`✅ Base URL: \`${newUrl}\``);
  }
  if (newModel) {
    process.env.PRIMARY_MODEL = newModel;
    config.apis.primary.model = newModel;
    changes.push(`✅ Modelo: \`${newModel}\``);
  }

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Configuración Actualizada')
    .setColor(0x2B0045)
    .setDescription(changes.length > 0 ? changes.join('\n') : 'Sin cambios realizados.')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  await interaction.followUp({
    content: '🔄 Midiendo latencia de APIs...',
    ephemeral: true,
  });

  const statuses = await getAllAPIStatus();
  const statusEmbed = new EmbedBuilder()
    .setTitle('📡 Estado de APIs')
    .setColor(0x1A0040)
    .setTimestamp();

  for (const api of statuses) {
    statusEmbed.addFields({
      name: api.name,
      value: `${api.status} | Latencia: ${api.latency === -1 ? '❌ Sin respuesta' : `\`${api.latency}ms\``}`,
      inline: false,
    });
  }

  await interaction.followUp({ embeds: [statusEmbed], ephemeral: true });
}

module.exports = { handleConfig, handleConfigModalSubmit };
