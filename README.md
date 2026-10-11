# Sistema de Control de Padrón Electoral

Sistema web profesional para control de padrón electoral y registro de asistencia/votos distribuido, con sincronización en tiempo real entre múltiples operadores mediante Supabase.

## Características Principales

- **Búsqueda por cédula** ultra-rápida con autofoco, Enter y validación visual (PY 7-8 dígitos)
- **Tres estados visuales**: Habilitado (verde), Ya Registrado (rojo), Desconocido (ámbar)
- **Orden, Mesa, Referente**: Tarjetas informativas grandes con botón de copiar al portapapeles
- **Registro de personas no cargadas** en el padrón (modal con Nombre + Orden + Mesa + Referente + enlace TSJE)
- **Multi-usuario**: Login seguro con Supabase Auth, cada registro guarda quién lo realizó y su sede
- **Tiempo real**: Sincronización instantánea via Supabase Realtime entre notebooks/pestañas
- **Importación Excel** masiva con upsert, deduplicación automática, barra de progreso
- **Modo Demo offline** con datos de prueba para testear sin configurar Supabase
- **Estadísticas en vivo**: Total, Registrados, Pendientes
- **Log de actividad** con timestamp, operador, sede, filtros, export CSV
- **Ver datos importados**: Tabla buscable, filtros por estado, export CSV
- **Configuración Supabase robusta**: Auto-limpia URL, limpia cliente anterior, botón "Limpiar" con confirmación
- **Copiar al portapapeles**: Click en cédula/orden/mesa/zona → toast de confirmación
- **Sonidos**: Beep éxito/error al registrar (Web Audio API)
- **Detección offline**: Banner automático + sincronización al reconectar
- **Backup/Restore**: Export/Import JSON completo (datos + config + log)
- **Validación cédula PY**: Feedback visual en tiempo real (ámbar <7 dígitos, verde ≥7)

## Seguridad

- **Sin credenciales hardcodeadas**: Configuración vía servidor backend seguro
- **Content Security Policy (CSP)** estricta implementada
- **Rate limiting** en cliente (búsquedas: 60/min, registros: 20/min, importaciones: 5/5min)
- **Validación y sanitización** de todas las entradas (XSS prevention)
- **Encriptación AES-GCM** para datos sensibles en localStorage (clave por sesión)
- **Auditoría completa**: LOGIN, REGISTER, VOTE, IMPORT, LOGOUT con detalles
- **Gestión de sesión segura**: Logout con auditoría, claves en sessionStorage
- **Headers de seguridad**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, Tailwind CSS (CDN), JavaScript Vanilla (ES6+) |
| Backend/DB | Supabase (PostgreSQL + Realtime + Auth) |
| Importación | SheetJS (xlsx CDN) |
| Almacenamiento local | localStorage encriptado (config, datos demo, logs) |
| Despliegue | Archivo único `index.html` servido estáticamente |

## Estructura del Proyecto

```
├── index.html              # Aplicación completa (HTML + CSS + JS)
├── README.md               # Esta documentación
├── supabase.min.js         # Cliente Supabase local (CDN fallback)
└── .gitignore              # Archivos ignorados por git
```

## Requisitos Previos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Servidor HTTP local (requerido por CORS, localStorage, módulos ES)
- Cuenta Supabase (para modo producción)

## Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/starnicosvv/Plataforma-de-Automatizaci-n-para-confirmaci-n-de-votos.git
cd Plataforma-de-Automatizaci-n-para-confirmaci-n-de-votos
```

### 2. Iniciar servidor local

**Opción A: Python 3 (recomendado)**
```bash
python -m http.server 8080
```

**Opción B: Node.js (npx)**
```bash
npx serve .
```

**Opción C: PHP**
```bash
php -S localhost:8080
```

**Opción D: VS Code**
- Extensión "Live Server"
- Click derecho en `index.html` → "Open with Live Server"

### 3. Abrir en navegador

```
http://localhost:8080
```

> ⚠️ **NO abrir `index.html` con doble clic** (protocolo `file://` bloquea localStorage, CDN y módulos ES)

## Configuración de Supabase (Producción)

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New Project
2. Copiar **Project URL** y **anon public key** (Settings → API)

### 2. Crear tablas necesarias

Ejecutar en SQL Editor de Supabase:

```sql
-- Tabla principal: padrón electoral
create table padron (
  cedula text primary key,
  nombre text not null,
  orden integer,
  mesa integer,
  referente text,
  zona_votacion text,
  ya_registrado boolean default false,
  fecha_registro timestamptz,
  registrado_por text
);

-- Habilitar Realtime para sincronización
alter publication supabase_realtime add table padron;

-- Tabla de sedes (ubicaciones)
create table sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz default now()
);

-- Tabla de perfiles (extiende auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  sede_id uuid references sedes(id),
  role text default 'operador' check (role in ('admin', 'operador')),
  created_at timestamptz default now()
);

-- Habilitar Realtime
alter publication supabase_realtime add table sedes;
alter publication supabase_realtime add table profiles;

-- RLS para sedes
alter table sedes enable row level security;
create policy "Todos pueden leer sedes" on sedes for select using (true);
create policy "Admins pueden insertar sedes" on sedes for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- RLS para profiles
alter table profiles enable row level security;
create policy "Usuarios ven su perfil" on profiles for select using (auth.uid() = id);
create policy "Admins ven todos los perfiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Users insertan su perfil" on profiles for insert with check (auth.uid() = id);
create policy "Admins actualizan perfiles" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, nombre, role)
  values (new.id, new.email, new.raw_user_meta_data->>'nombre', 'operador');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tablas de auditoría
create table activity_log (
  id bigserial primary key,
  cedula text not null,
  nombre text not null,
  accion text not null,
  usuario text,
  sede text,
  timestamp timestamptz not null
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  accion text not null,
  detalles jsonb,
  usuario text,
  usuario_id uuid,
  sede text,
  user_agent text,
  timestamp timestamptz not null
);

-- Habilitar Realtime para logs
alter publication supabase_realtime add table activity_log;
```

### 3. Crear sedes y configurar

```sql
-- Insertar sedes (ejemplos)
insert into sedes (nombre) values 
  ('Sede Central'),
  ('Sede Norte'),
  ('Sede Sur');
```

### 4. Configurar en la app

1. Abrir la app → botón **"Config"** (engranaje)
2. Pegar **URL** y **Anon Key**
3. Click **"Guardar y Conectar"**
4. Registrarse como primer usuario (será 'operador')
5. Para hacer admin: `update profiles set role = 'admin' where email = 'tu@email.com';`

## Uso del Sistema

### Primer acceso - Login de Operador

1. Al abrir, aparece modal **"Iniciar Sesión"**
2. Crear usuario con email, contraseña (≥8 chars, mayúsculas, minúsculas, números, símbolos), nombre y sede
3. El badge superior muestra el operador activo y su sede

### Buscar y Registrar

1. Escribir cédula en el campo central → **Enter** o botón **"Consultar"**
2. **Validación visual**: borde ámbar (<7 dígitos), verde (≥7 dígitos)

**Resultado A - En padrón, no registrado (Verde)**
- Nombre grande en verde
- **Tarjetas**: ORDEN (verde) / MESA (azul) / ZONA (púrpura) — click para copiar
- **Referente** texto pequeño abajo
- Botón **"REGISTRAR"** → confirma, sonido éxito, toast, limpia campo

**Resultado B - Ya registrado (Rojo)**
- Alerta: "¡ATENCIÓN! ESTA PERSONA YA ESTÁ REGISTRADA"
- Tarjetas Orden/Mesa/Zona + Referente
- Muestra fecha/hora exacta y **quién la registró**
- Botón deshabilitado

**Resultado C - No está en padrón (Ámbar)**
- "NO ENCONTRADA EN PADRÓN" + "Nombre: Desconocido"
- Botón **"REGISTRAR PERSONA DESCONOCIDA"** → modal para ingresar Nombre + Orden + Mesa + Referente + Zona + enlace a padron.tsje.gov.py
- Al confirmar: crea registro + marca como registrado + sonido éxito

### Copiar datos al portapapeles

- Click en **Cédula** → "Cédula copiada"
- Click en **Orden** (tarjeta verde) → "Orden copiado"
- Click en **Mesa** (tarjeta azul) → "Mesa copiada"
- Click en **Zona** (tarjeta púrpura) → "Zona copiada"

### Cargar Padrón (Excel)

1. Botón **"Cargar Padrón"** → selecciona `.xlsx`/`.xls`
2. Columnas: `cedula`, `nombre` (requeridas) + `orden`, `mesa`, `referente`, `zona_votacion` (opcionales)
3. **Duplicados**: se eliminan automáticamente (keep last)
4. Vista previa de primeras 5 filas con ejemplo de formato
5. **"Importar Padrón"** → lotes de 500, barra progreso
6. **Upsert**: actualiza nombres si cédula existe, **no toca** `ya_registrado` ni `fecha_registro`

### Formato Excel esperado

```csv
cedula, nombre, orden, mesa, referente, zona_votacion
1234567, Juan Pérez, 1, 101, Carlos R., Escuela N° 123
8765432, María López, 2, 101, Ana M., Colegio Nacional
```

### Backup / Restore (Menú ▼)

- **Exportar Backup (JSON)**: Descarga todo (padrón + log + config)
- **Importar Backup (JSON)**: Restaura estado completo + recarga app

### Estadísticas y Actividad

- **Tarjetas superiores**: Total en padrón / Ya Registrados / Pendientes (actualizan en tiempo real)
- **Panel lateral**: Log de consultas y registros con operador, sede y hora

### Multi-operador (Simultáneo)

1. Abrir `http://localhost:8080` en varias notebooks/pestañas
2. Cada una: crear usuario distinto ("Mesa 1", "Mesa 2", "Escuela X")
3. Todos ven actualizaciones instantáneas via Realtime

## Modo Demo (Offline)

- Activo por defecto sin configurar Supabase
- 8 registros de prueba (2 ya registrados)
- Datos persisten en `localStorage` encriptado (`padron_demo_data`)
- Funcionalidad completa: búsqueda, registro, importación, stats
- Botón **"Modo Demo"** ↔ **"Supabase"** para alternar

## Deploy a Producción (Vercel / Netlify / Cloudflare Pages)

### Vercel (recomendado, gratis)
1. `vercel.com` → **Add New Project** → Import GitHub repo
2. Framework: **Other** · Build: (vacío) · Output: `.`
3. **Deploy** → URL `https://padron-xxx.vercel.app` con HTTPS automático

### Netlify
1. `netlify.com` → **Add new site** → Import from Git
2. Build command: (vacío) · Publish directory: `.`
3. **Deploy**

### Cloudflare Pages
1. `dash.cloudflare.com` → Pages → Connect to Git
2. Build: (vacío) · Output: `.`
3. **Deploy** (gratis, sin límites bandwidth)

> **Nota**: En todos los casos, servir como sitio estático. El `index.html` contiene todo.

## Solución de Problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| Página en blanco | Abierto como `file://` | Usar servidor local (`http://localhost:8080`) |
| "Tracking Prevention blocked" | Navegador bloquea CDN | Servir localmente; desactivar shields en Brave |
| No guarda usuario | localStorage bloqueado | Servir en `http://` no `file://` |
| Error conexión Supabase | Credenciales inválidas | Verificar URL y Anon Key en Config |
| Realtime no funciona | Tabla no en publication | `alter publication supabase_realtime add table padron;` |
| Import falla | Columnas incorrectas | Excel debe tener headers `cedula` y `nombre` |

## Licencia

MIT License - Uso libre para fines electorales, educativos y cívicos.

## Soporte

- Issues: [GitHub Issues](https://github.com/starnicosvv/Plataforma-de-Automatizaci-n-para-confirmaci-n-de-votos/issues)
- Documentación Supabase: [supabase.com/docs](https://supabase.com/docs)
- SheetJS: [sheetjs.com](https://sheetjs.com)

---

**Desarrollado para procesos electorales transparentes y auditables** 🗳️