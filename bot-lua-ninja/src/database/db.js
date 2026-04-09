'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'lua_ninja.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    language TEXT DEFAULT 'es',
    base_tokens INTEGER DEFAULT 10,
    gift_bp INTEGER DEFAULT 0,
    is_restricted INTEGER DEFAULT 0,
    bypass_used_today INTEGER DEFAULT 0,
    last_reset TEXT DEFAULT (date('now')),
    is_super_owner INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS active_threads (
    user_id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    thread_name TEXT,
    channel_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS thread_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    system_name TEXT NOT NULL,
    language TEXT,
    main_function TEXT,
    code_content TEXT NOT NULL,
    is_private INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS spam_tracker (
    user_id TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 0,
    window_start TEXT DEFAULT (datetime('now')),
    banned_until TEXT
  );

  CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    song_url TEXT NOT NULL,
    added_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_latency (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
  );
`);

const stmt = {
  getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
  createUser: db.prepare(`INSERT OR IGNORE INTO users (user_id, base_tokens, gift_bp) VALUES (?, 10, 0)`),
  updateLanguage: db.prepare('UPDATE users SET language = ? WHERE user_id = ?'),
  getLanguage: db.prepare('SELECT language FROM users WHERE user_id = ?'),
  deductBaseToken: db.prepare('UPDATE users SET base_tokens = base_tokens - 1 WHERE user_id = ?'),
  deductBypassTokens: db.prepare(`
    UPDATE users SET
      gift_bp = CASE WHEN gift_bp >= 1 THEN gift_bp - 1 ELSE gift_bp END,
      base_tokens = CASE WHEN gift_bp < 1 THEN base_tokens - 2 ELSE base_tokens END,
      bypass_used_today = bypass_used_today + 1
    WHERE user_id = ?
  `),
  giveBaseTokens: db.prepare('UPDATE users SET base_tokens = base_tokens + ? WHERE user_id = ?'),
  giveBypassTokens: db.prepare('UPDATE users SET gift_bp = gift_bp + ? WHERE user_id = ?'),
  restrictUser: db.prepare('UPDATE users SET is_restricted = 1 WHERE user_id = ?'),
  unrestrictUser: db.prepare('UPDATE users SET is_restricted = 0 WHERE user_id = ?'),
  cleanUser: db.prepare('UPDATE users SET base_tokens = 0, gift_bp = 0 WHERE user_id = ?'),
  resetDailyTokens: db.prepare(`UPDATE users SET base_tokens = 10, bypass_used_today = 0, last_reset = date('now') WHERE last_reset < date('now')`),
  setActiveThread: db.prepare(`INSERT OR REPLACE INTO active_threads (user_id, thread_id, thread_name, channel_id) VALUES (?, ?, ?, ?)`),
  getActiveThread: db.prepare('SELECT * FROM active_threads WHERE user_id = ?'),
  deleteActiveThread: db.prepare('DELETE FROM active_threads WHERE user_id = ?'),
  getAllActiveThreads: db.prepare('SELECT * FROM active_threads'),
  addThreadContext: db.prepare(`INSERT INTO thread_context (thread_id, role, content) VALUES (?, ?, ?)`),
  getThreadContext: db.prepare(`SELECT role, content FROM thread_context WHERE thread_id = ? ORDER BY timestamp ASC LIMIT 40`),
  clearThreadContext: db.prepare('DELETE FROM thread_context WHERE thread_id = ?'),
  saveVault: db.prepare(`INSERT INTO vault (owner_id, system_name, language, main_function, code_content, is_private) VALUES (?, ?, ?, ?, ?, ?)`),
  findVaultByName: db.prepare(`SELECT * FROM vault WHERE (owner_id = ? OR is_private = 0) AND system_name LIKE ? ORDER BY created_at DESC`),
  findVaultOwnerOnly: db.prepare(`SELECT * FROM vault WHERE system_name LIKE ? ORDER BY created_at DESC`),
  findVaultByKeyword: db.prepare(`SELECT * FROM vault WHERE owner_id = ? AND (system_name LIKE ? OR main_function LIKE ? OR language LIKE ?) ORDER BY created_at DESC`),
  findVaultAllOwner: db.prepare('SELECT id, system_name, language, main_function, owner_id, created_at FROM vault ORDER BY created_at DESC'),
  getVaultById: db.prepare('SELECT * FROM vault WHERE id = ?'),
  getSpamRecord: db.prepare('SELECT * FROM spam_tracker WHERE user_id = ?'),
  upsertSpamRecord: db.prepare(`
    INSERT INTO spam_tracker (user_id, request_count, window_start)
    VALUES (?, 1, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      request_count = CASE
        WHEN (julianday('now') - julianday(window_start)) * 86400000 > ?
        THEN 1
        ELSE request_count + 1
      END,
      window_start = CASE
        WHEN (julianday('now') - julianday(window_start)) * 86400000 > ?
        THEN datetime('now')
        ELSE window_start
      END
  `),
  upsertBan: db.prepare(`INSERT INTO spam_tracker (user_id, banned_until) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET banned_until = excluded.banned_until`),
  getSystemState: db.prepare('SELECT value FROM system_state WHERE key = ?'),
  setSystemState: db.prepare(`INSERT INTO system_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
  addFavorite: db.prepare('INSERT INTO user_favorites (user_id, song_title, song_url) VALUES (?, ?, ?)'),
  getFavorites: db.prepare('SELECT * FROM user_favorites WHERE user_id = ? ORDER BY added_at ASC'),
  logLatency: db.prepare('INSERT INTO agent_latency (agent_name, latency_ms) VALUES (?, ?)'),
  getAvgLatency: db.prepare(`SELECT agent_name, AVG(latency_ms) as avg_ms FROM agent_latency WHERE timestamp > datetime('now', '-1 hour') GROUP BY agent_name`),
  setSuperOwner: db.prepare('UPDATE users SET is_super_owner = ? WHERE user_id = ?'),
};

stmt.db = db;

function ensureUser(userId) {
  stmt.createUser.run(userId);
  stmt.resetDailyTokens.run();
  return stmt.getUser.get(userId);
}

function getUserLanguage(userId) {
  ensureUser(userId);
  const row = stmt.getLanguage.get(userId);
  return row ? row.language : 'es';
}

function isUserBanned(userId) {
  const record = stmt.getSpamRecord.get(userId);
  if (!record || !record.banned_until) return false;
  return new Date(record.banned_until) > new Date();
}

function recordRequest(userId, spamWindowMs) {
  stmt.upsertSpamRecord.run(userId, spamWindowMs, spamWindowMs);
  const record = stmt.getSpamRecord.get(userId);
  return record ? record.request_count : 1;
}

module.exports = {
  db,
  stmt,
  ensureUser,
  getUserLanguage,
  isUserBanned,
  recordRequest,
};
