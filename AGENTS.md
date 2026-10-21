# MEMORIA DE TRABAJO — Sistema Padrón

> Archivo de memoria para el agente. Actualizar SIEMPRE al avanzar.

## Contexto del proyecto

- App de una sola página: `index.html` (~3300 líneas, HTML + CSS + JS vanilla).
- Backend opcional Supabase (`supabase.min.js` local, CDN de Tailwind y SheetJS).
- Modo Demo offline por defecto (localStorage encriptado AES-GCM).
- Repo git en rama `master`, remoto GitHub `starnicosvv/Plataforma-de-Automatizaci-n-para-confirmaci-n-de-votos`.
- `portfolio-temp/` y `starnicosvv-profile/` son otros proyectos anidados (ignorar salvo que se pida).
- Scripts auxiliares: `convert_excel.js`, `convert_libro1.js`, `convert_carmen.js` (Node + xlsx), `fix_login.py`/`fix_syntax.py` (parches viejos ya aplicados; no volver a correr).
- Entorno: Windows, PowerShell 5.1, Node v24.14.1, Python 3.14.3, Edge instalado.
- OJO: el archivo se reescribió una vez con `[System.IO.File]::WriteAllText` UTF-8 sin BOM. Mantener esa codificación (sin BOM).

## Estado actual: FUNCIONANDO (verificado en Edge headless 2026-10-21)

### Causa raíz encontrada y corregida

Había **3 `<div>` sin cerrar** que anidaban toda la app y los modales dentro de `#login-modal`:

- `#login-modal` (faltaba cierre del overlay).
- `#register-unknown-modal`.
- `#import-modal`.

Consecuencia: al cerrar el login se ocultaba TODA la app; Config/Import/Registro desconocido no podían verse porque su padre estaba `display:none`. Verificado con parser Python (`UNCLOSED DIVS: []` ahora).

### Todos los fixes aplicados (2026-10-21)

1. Cerrados los 3 divs (estructura DOM OK).
2. Registro de usuario en Modo Demo implementado (antes llamaba a Supabase y fallaba). Crea usuario local, guarda en `padron_users`, precarga email en login. `loadSedes`/`showRegisterForm` agregan "Sede Demo (local)" en demo.
3. `switchUser()` en demo ahora limpia `currentUser` + `padron_current_user` y muestra login.
4. `renderViewDataModal()` ahora aplica el filtro de estado también en demo (y búsqueda robusta con `String(...)`).
5. `Security.validateText()` ahora permite `# ° º ª` (zonas "Escuela N° 123").
6. `Security.sanitizeForAttribute()` ahora escapa de verdad (`&amp; &quot; &#39; &lt; &gt;`); se usa en el filtro de usuarios del log.
7. `registerVote()` en Supabase llama `updateStats()` tras upsert.
8. `showToast()` escapa el mensaje (XSS) con `escapeHtml`.
9. Nuevo `formatTime()` para el log; `formatDate()` devuelve '-' si fecha inválida.
10. `onAuthStateChange` con flag `authListenerAttached` (sin listeners duplicados).
11. `initSupabase()` es idempotente si url/key no cambiaron (no cierra sesión válida al reconectar). Guarda `sbClientUrl/sbClientKey`.
12. Clave de encriptación ahora persiste en `localStorage` (`padron_encryption_key`, con fallback a la vieja `sessionStorage.encryption_key`). Antes se regeneraba por pestaña y los datos demo "desaparecían" al abrir otra pestaña/sesión.
13. Otras mejoras: `loadUsers()` dedicada; `saveCurrentUser` usa `CURRENT_USER_KEY`; guard de `currentProfile` nulo tras login Supabase; `loadCurrentSession` resetea `currentProfile`; botón "Configurar conexión Supabase" en el modal de login (recuperación si la config está mal); limpieza de actividad ahora persiste; CSV con BOM UTF-8 para Excel; `signUp` no falla si no puede asignar sede (p. ej. email sin confirmar) y avisa "revisa tu correo"; importBackup guarda activityLog; se quitó `frame-ancestors`/`X-Frame-Options` del meta (el browser los ignora y tiraban error de consola); `signUp`/login demo sin sede obligatoria.

## Verificación automatizada (Edge headless + CDP)

Scripts temporales (fuera del repo): `C:\Users\NICOLS~1\AppData\Local\Temp\opencode\cdp-test.js` y `cdp-reload.js`.

Cómo correr (resumen):
1. `python -m http.server 8765 --bind 127.0.0.1` en el workdir.
2. `msedge.exe --headless=new --disable-gpu --remote-debugging-port=9222 --user-data-dir=<temp>\edge-profile about:blank`.
3. `node cdp-test.js` (usa `fetch` + `WebSocket` nativos de Node 24; limpia localStorage con `Page.addScriptToEvaluateOnNewDocument`).

Resultados (todos OK, sin excepciones ni errores de consola salvo warning del CDN de Tailwind):
- Login demo → app visible, badge operador.
- Búsqueda habilitado / ya registrado / desconocido.
- Registrar voto (stats 8/2/6 → 8/3/5).
- Registrar desconocido con zona "Escuela N° 123, Sede #5" (antes rechazada).
- Modales Config/Import/Log/VerDatos abren (visible).
- Filtro VerDatos: registrados 4 / pendientes 5 / todos 9.
- Import Excel demo (2 filas, incluye zona con °) → total 11.
- switchUser demo limpia sesión; alta de usuario demo; login con el nuevo usuario.
- Persistencia tras recargar: 11 registros, auto-login, datos restaurados desde localStorage encriptado.

## Pendientes / ideas (no bloqueantes)

- Probar contra un Supabase real (no hay credenciales): flujo signUp con confirmación de email, RLS, Realtime.
- `PRODUCTION_CONFIG` está `enabled:false` (por diseño). Si se habilita, el botón de modo demo se oculta.
- Los tests CDP están en temp; si se quiere, moverlos a `tests/` del repo (el usuario no lo pidió).
- `README.md` aún dice que la clave de encriptación es "por sesión"; quedó desactualizado (ahora persiste en localStorage).
- `fix_login.py` y `fix_syntax.py` siguen untracked; se pueden borrar si el usuario quiere.

## Notas para retomar

- No commitear salvo que el usuario lo pida.
- Mantener estilo del código existente (sin comentarios nuevos innecesarios).
- El usuario habla español; responder en español.
- Al hacer cambios en `index.html`: verificar con `node --check` del script inline y con el parser de divs (Python html.parser) antes de dar por cerrado.
