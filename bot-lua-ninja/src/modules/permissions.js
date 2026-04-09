'use strict';

const config = require('../config');
const { stmt, ensureUser, isUserBanned } = require('../database/db');

const PERM = {
  OWNER: 'OWNER',
  SUPER_OWNER: 'SUPER_OWNER',
  NORMAL: 'NORMAL',
  DENIED: 'DENIED',
  BANNED: 'BANNED',
};

function getUserPermission(member, userId) {
  if (isUserBanned(userId)) return PERM.BANNED;

  const user = ensureUser(userId);
  if (user && user.is_super_owner) return PERM.SUPER_OWNER;

  if (userId === config.ids.owner) return PERM.OWNER;

  const hasNormalRole = member.roles && member.roles.cache
    ? member.roles.cache.has(config.ids.normalRole)
    : false;

  if (hasNormalRole) return PERM.NORMAL;

  return PERM.DENIED;
}

function isOwner(userId) {
  const user = ensureUser(userId);
  return userId === config.ids.owner || (user && user.is_super_owner === 1);
}

function isAdmin(member) {
  return member.permissions && member.permissions.has('Administrator');
}

function isOwnerOrAdmin(member, userId) {
  return isOwner(userId) || isAdmin(member);
}

function canUseDevCommands(member, userId) {
  return isOwnerOrAdmin(member, userId);
}

function canUseCode(member, userId) {
  const perm = getUserPermission(member, userId);
  return perm !== PERM.DENIED && perm !== PERM.BANNED;
}

function checkBypassAvailable(userId) {
  const user = ensureUser(userId);
  if (isOwner(userId)) return { allowed: true, infinite: true };
  if (!user) return { allowed: false, reason: 'Usuario no registrado.' };
  if (user.is_restricted) return { allowed: false, reason: '🚫 Acceso restringido por el administrador.' };

  const bypassUsed = user.bypass_used_today || 0;
  if (bypassUsed >= 3) {
    return { allowed: false, reason: '⛔ Has alcanzado el límite de 3 usos de `#code/` por día.' };
  }

  const totalAvailable = user.base_tokens + user.gift_bp;
  if (totalAvailable < 2) {
    return { allowed: false, reason: '⚠️ Energía insuficiente para el modo Bypass (requiere 2 tokens).' };
  }

  return { allowed: true };
}

function checkTokenAvailable(userId) {
  if (isOwner(userId)) return { allowed: true, infinite: true };
  const user = ensureUser(userId);
  if (!user) return { allowed: false, reason: 'Usuario no registrado.' };
  if (user.is_restricted) return { allowed: false, reason: '🚫 Acceso restringido.' };
  if (user.base_tokens <= 0) {
    return {
      allowed: false,
      reason: '⚠️ Te has quedado sin energía de procesamiento.\n\n' +
              'Consigue más tokens del Owner o participa en eventos.',
    };
  }
  return { allowed: true };
}

module.exports = {
  PERM,
  getUserPermission,
  isOwner,
  isAdmin,
  isOwnerOrAdmin,
  canUseDevCommands,
  canUseCode,
  checkBypassAvailable,
  checkTokenAvailable,
};
