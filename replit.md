# Bot Lua Ninja — Sistema Autónomo de Ingeniería de Software

## Descripción
Bot de Discord completamente modular que actúa como un Agente de Ingeniería de Software Autónomo. Construido en Node.js con discord.js v14.

## Estado del Sistema
- **Bot Online:** Lua Ninja#2211 (ID: 1489470381214531604)
- **Heartbeat Server:** Puerto 3000 (anti-sleep activo)
- **Base de Datos:** SQLite integrado de Node.js v24 (experimental)

## Arquitectura — Pipeline de 4 Agentes

```
Usuario → [Agente Interfaz: GPT-4o-mini]
        → [Agente Investigador: Perplexity Sonar]
        → [Agente Ingeniero: Llama 3.1 405B → GPT-4o → Llama 70B]
        → [Agente Formateador: Anti-ruido + UTF-8]
        → [Hilo Privado del Usuario]
```

## Estructura de Archivos
```
bot-lua-ninja/
├── .env                          # Variables de entorno (seguras)
├── index.js                      # Entry point principal
├── package.json
├── src/
│   ├── config.js                 # Carga y valida .env, decodifica IDs
│   ├── database/
│   │   └── db.js                 # SQLite (node:sqlite nativo)
│   ├── agents/
│   │   ├── interfaceAgent.js     # GPT-4o-mini: Brief técnico
│   │   ├── researchAgent.js      # Perplexity: Documentación 2026
│   │   ├── engineerAgent.js      # Llama 405B: Generación de código
│   │   └── formatterAgent.js     # Limpieza + OMNI-GUARDIAN scan
│   ├── modules/
│   │   ├── permissions.js        # Sistema de roles y permisos
│   │   ├── apiClient.js          # Cliente resiliente con fallback
│   │   ├── fileOutput.js         # Salida UTF-8 / anti-markdown
│   │   ├── heartbeat.js          # Express anti-sleep server
│   │   ├── omniGuardian.js       # Seguridad y monitoreo
│   │   ├── threadManager.js      # Hilos privados por usuario
│   │   └── vault.js              # Baúl de Sombras (repositorio)
│   └── commands/
│       ├── code.js               # #code / #code/
│       ├── fix.js                # #fix
│       ├── config.js             # #config (modal)
│       ├── channel.js            # #channel
│       ├── back.js               # #back
│       ├── coman.js              # #coman
│       ├── idioma.js             # #Idioma
│       ├── promt.js              # #promt
│       ├── guardian.js           # #guardian
│       ├── vaultCmd.js           # #save / #find / #find/
│       ├── threadCmd.js          # #archive / #Close/hilo
│       ├── filtro.js             # #filtro on/off
│       ├── ghost.js              # #authorization / #purge
│       ├── economyCmd.js         # give, #give/, #ban, #unban...
│       └── shadowBeats.js        # #play, #radio, #board, #favs
```

## IDs de Seguridad (Codificados en .env)
- `_OWN`: ID del Owner (codificado en Base64)
- `_RID`: ID del Rol de Usuarios Normales (codificado)
- `_VID`: ID del Canal Baúl (codificado)
- `GHOST_KEY_HASH`: SHA-256 de la llave fantasma
- `MASTER_UNLOCK_HASH`: SHA-256 del PIN maestro

## APIs Configuradas
- **Primaria:** OpenRouter → Llama 3.1 405B (Agente Ingeniero)
- **Respaldo 1:** OpenAI → GPT-4o
- **Respaldo 2:** Groq → Llama 70B
- **Interfaz:** OpenAI → GPT-4o-mini
- **Investigador:** Perplexity → Sonar

## Módulos Implementados
1. Pipeline de 4 Agentes (Interfaz → Investigador → Ingeniero → Formateador)
2. Sistema de Hilos Privados por usuario
3. Baúl de Sombras con metadatos y búsqueda semántica
4. OMNI-GUARDIAN: Anti-spam, anti-DoS, cuarentena, alertas DM
5. Economía de Tokens (SQLite): base_tokens + gift_bp
6. Shadow-Beats: DJ con botones interactivos + favoritos
7. Protocolo Fantasma (Ghost Operator) con SUPER_SECRET_KEY
8. Shadow-Decoy: Modo Cuarentena con Honey-Pot
9. Opción Nuclear (#purge) con LOCK_FILE
10. Módulo #promt: Prompt Engineering 5 estrellas
11. Sistema de Fallback automático de APIs con notificación DM
12. Servidor Heartbeat Express (puerto 3000)
13. Sistema de idiomas persistente por usuario
14. Zero-Leak Architecture: todos los secretos en .env ofuscados

## Para Iniciar
```bash
cd bot-lua-ninja && npm start
```
