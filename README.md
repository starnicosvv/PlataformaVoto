# Sistema de Control de Padrón Electoral y Registro en Tiempo Real

Sistema web para control de padrón electoral y registro de asistencia/votos distribuido, con sincronización en tiempo real entre múltiples operadores mediante Supabase.

## Características Principales

- **Búsqueda por cédula** ultra-rápida con autofoco, Enter y validación visual (PY 7-8 dígitos)
- **Tres estados visuales**: Habilitado (verde cajas grandes Orden/Mesa), Ya Registrado (rojo), Desconocido (ámbar)
- **Orden, Mesa, Referente**: Cajas grandes tipo tarjeta (verde/azul) + texto pequeño Referente
- **Registro de personas no cargadas** en el padrón (modal con Nombre + Orden + Mesa + Referente + link TSJE)
- **Multi-usuario**: Login de operadores, cada registro guarda quién lo realizó
- **Tiempo real**: Sincronización instantánea via Supabase Realtime entre notebooks/pestañas
- **Importación Excel** masiva con upsert, deduplicación automática, `ignoreDuplicates: true`, barra progreso
- **Modo Demo offline** con datos de prueba para testear sin configurar Supabase
- **Estadísticas en vivo**: Total, Registrados, Pendientes
- **Log de actividad** con timestamp, operador, filtros, export CSV
- **Ver datos importados**: Tabla buscable, filtros, export CSV con nuevos campos
- **Config Supabase robusta**: Auto-limpia URL (`/rest/v1/`), limpia cliente anterior, botón "Limpiar" con confirmación
- **Copiar al portapapeles**: Click en cédula/orden/mesa → toast "Copiado"
- **Sonidos**: Beep éxito/error al registrar (Web Audio API)
- **Detección offline**: Banner automático + sincronización al reconectar
- **Backup/Restore**: Export/Import JSON completo (datos + config + usuarios + log)
- **Validación cédula PY**: Feedback visual en tiempo real (ámbar <7 dígitos, verde ≥7)

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, Tailwind CSS (CDN), JavaScript Vanilla (ES6+) |
| Backend/DB | Supabase (PostgreSQL + Realtime) |
| Importación | SheetJS (xlsx CDN) |
| Almacenamiento local | localStorage (config, usuarios, datos demo) |
| Despliegue | Archivo único `index.html` servido estáticamente |

## Estructura del Proyecto

```
├── index.html              # Aplicación completa (HTML + CSS + JS)
├── README.md               # Esta documentación
├── convert_excel.js        # Script para convertir Excel crudo a formato padrón
├── convert_libro1.js       # Script específico para formato Libro1.xlsx (MESA, ORDEN, CEDULA, NOMBRE, APELLIDO, REFERENTE)
├── Libro1.xlsx             # Datos fuente (11,600 registros) - formato origen
├── padron_importar.xlsx    # Datos convertidos listos para importar (11,600 registros: cedula, nombre, orden, mesa, referente, zona_votacion)
├── temp_data.json          # Backup temporal de datos
└── supabase.min.js         # Cliente Supabase local (CDN fallback)
```

## Requisitos Previos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Servidor HTTP local (requerido por CORS, localStorage, módulos ES)
- Cuenta Supabase (opcional, para modo producción)

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

### 2. Crear tabla `padron`

```sql
-- Ejecutar en SQL Editor de Supabase
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

-- Habilitar Realtime
alter publication supabase_realtime add table padron;
```

### 2b. Crear tabla `users` (para compartir usuarios entre dispositivos - **DEPRECADO**, usar Auth)

```sql
-- Ejecutar en SQL Editor de Supabase
create table users (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

-- Habilitar Realtime (opcional)
alter publication supabase_realtime add table users;

-- Políticas RLS
alter table users enable row level security;

create policy "Todos pueden leer usuarios" on users
  for select using (true);

create policy "Todos pueden insertar usuarios" on users
  for insert with check (true);
```

### 2c. Configurar Autenticación y Sedés (NUEVO - Recomendado)

**1. Habilitar Auth en Supabase:**
- Dashboard → Authentication → Providers → Email → **Enable Email provider**
- Desactivar "Confirm email" para desarrollo (opcional)

**2. Crear tablas de perfiles y sedés:**

```sql
-- Tabla de sedés (ubicaciones)
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
```

**3. Crear sedés y primer admin:**
```sql
-- Insertar sedés (ej: 3 sedés)
insert into sedes (nombre) values 
  ('Sede Central'),
  ('Sede Norte'),
  ('Sede Sur');

-- El primer usuario que se registre vía la app será 'operador'
-- Para hacer admin, ejecutar manualmente:
-- update profiles set role = 'admin' where email = 'admin@ejemplo.com';
```

### 3. Configurar en la app

1. Abrir la app → botón **"Config"** (engranaje)
2. Pegar **URL** y **Anon Key**
3. Click **"Guardar y Conectar"**

### 4. Cambiar a modo Supabase

- Botón **"Modo Demo"** (ámbar) → se vuelve verde **"Supabase"**
- El sistema usa la config guardada automáticamente

## Uso del Sistema

### Primer acceso - Login de Operador

1. Al abrir, aparece modal **"Iniciar Sesión"**
2. Seleccionar usuario existente o crear nuevo (ej: "Mesa 1", "Escuela Norte")
3. El badge superior muestra el operador activo

### Buscar y Registrar

1. Escribir cédula en el campo central → **Enter** o botón **"Consultar"**
2. **Validación visual**: borde ámbar (<7 dígitos), verde (≥7 dígitos)

**Resultado A - En padrón, no registrado (Verde)**
- Nombre grande en verde
- **Cajas grandes**: ORDEN (verde) / MESA (azul) — click para copiar
- **Referente** texto pequeño abajo
- Botón **"REGISTRAR"** → confirma, sonido éxito, toast, limpia campo

**Resultado B - Ya registrado (Rojo)**
- Alerta: "¡ATENCIÓN! ESTA PERSONA YA ESTÁ REGISTRADA"
- Cajas grandes Orden/Mesa + Referente
- Muestra fecha/hora exacta y **quién la registró**
- Botón deshabilitado

**Resultado C - No está en padrón (Ámbar)**
- "NO ENCONTRADA EN PADRÓN" + "Nombre: Desconocido"
- Botón **"REGISTRAR PERSONA DESCONOCIDA"** → modal para ingresar Nombre + Orden + Mesa + Referente + link a padron.tsje.gov.py
- Al confirmar: crea registro + marca como registrado + sonido éxito

### Copiar datos al portapapeles
- Click en **Cédula** → "Cédula copiada"
- Click en **Orden** (caja verde) → "Orden copiado"
- Click en **Mesa** (caja azul) → "Mesa copiado"

### Cargar Padrón (Excel)

1. Botón **"Cargar Padrón"** → selecciona `.xlsx`/`.xls`
2. Columnas: `cedula`, `nombre` (requeridas) + `orden`, `mesa`, `referente`, `zona_votacion` (opcionales)
3. **Duplicados**: se eliminan automáticamente (keep last)
4. Vista previa de primeras 5 filas con ejemplo de formato
5. **"Importar Padrón"** → lotes de 500, barra progreso, `ignoreDuplicates: true`
6. **Upsert**: actualiza nombres si cédula existe, **no toca** `ya_registrado` ni `fecha_registro`

### Preparar Excel desde formato crudo (Scripts incluidos)

El proyecto incluye scripts para convertir Excel con columnas sucias al formato estándar:

| Archivo origen | Script | Formato origen | Formato destino |
|---|---|---|---|
| `Reporte_Referentes_Merged-10.xlsx` | `convert_excel.js` | `Referente, Teléfono, Zona, Nombre, Cédula, Tel, Orden, Mesa, Estado, Colegio` | `cedula, nombre, orden, mesa, referente, zona_votacion` |
| `Libro1.xlsx` | `convert_libro1.js` | `MESA, ORDEN, CEDULA, NOMBRE, APELLIDO, REFERENTE` | `cedula, nombre, orden, mesa, referente, zona_votacion` |

**Uso:**
```bash
# Para Reporte_Referentes_Merged-10.xlsx
node convert_excel.js

# Para Libro1.xlsx
node convert_libro1.js
```

Ambos generan `padron_importar.xlsx` listo para usar en "Cargar Padrón" (últimos 11,600 registros procesados).

### Backup / Restore (Menú ▼)
- **Exportar Backup (JSON)**: Descarga todo (padrón + usuarios + log + config)
- **Importar Backup (JSON)**: Restaura estado completo + recarga app

### Estadísticas y Actividad

- **Tarjetas superiores**: Total en padrón / Ya Registrados / Pendientes (actualizan en tiempo real)
- **Panel lateral**: Log de consultas y registros con operador y hora

### Multi-operador (Simultáneo)

1. Abrir `http://localhost:8080` en varias notebooks/pestañas
2. Cada una: crear usuario distinto ("Mesa 1", "Mesa 2", "Escuela X")
3. Todos ven actualizaciones instantáneas via Realtime

## Modo Demo (Offline)

- Activo por defecto sin configurar Supabase
- 8 registros de prueba (2 ya registrados)
- Datos persisten en `localStorage` (`padron_demo_data`)
- Funcionalidad completa: búsqueda, registro, importación, stats
- Botón **"Modo Demo"** ↔ **"Supabase"** para alternar

## Estructura de Datos

### Tabla `padron` (Supabase / localStorage)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `cedula` | TEXT PK | Número de documento único |
| `nombre` | TEXT | Nombre completo |
| `orden` | INTEGER | N° de orden en mesa (opcional) |
| `mesa` | INTEGER | N° de mesa receptora (opcional) |
| `referente` | TEXT | Nombre del referente (opcional) |
| `zona_votacion` | TEXT | Escuela/colegio de votación (opcional) |
| `ya_registrado` | BOOLEAN | Default: false |
| `fecha_registro` | TIMESTAMPTZ | Nullable, ISO 8601 |
| `registrado_por` | TEXT | Nombre del operador |

### localStorage Keys

| Key | Contenido |
|-----|-----------|
| `padron_supabase_config` | `{url, key}` Supabase |
| `padron_demo_data` | Array de objetos padrón (demo) |
| `padron_users` | Array de usuarios `{id, name, created_at}` |
| `padron_current_user` | `{id, name}` sesión activa |

## Flujo de Datos (Arquitectura)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Navegador  │────▶│  Supabase    │◀───│  Navegador  │
│  (Operador) │     │  PostgreSQL  │    │  (Operador) │
└─────────────┘     │  + Realtime  │    └─────────────┘
       ▲            └──────┬───────┘           ▲
       │                   │                   │
       │   WebSocket       │   WebSocket       │
       │   (Realtime)      │   (Realtime)      │
       └───────────────────┴───────────────────┘
              Sincronización instantánea
```

## API Supabase Utilizada

```javascript
// Cliente
const sbClient = supabase.createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } }
});

// Consulta única
const { data, error } = await sbClient
  .from('padron')
  .select('*')
  .eq('cedula', cedula)
  .single();

// Upsert masivo (importación)
await sbClient.from('padron').upsert(registros, {
  onConflict: 'cedula',
  ignoreDuplicates: false
});

// Update registro
await sbClient.from('padron').update({
  ya_registrado: true,
  fecha_registro: now,
  registrado_por: usuario
}).eq('cedula', cedula);

// Suscripción Realtime
sbClient.channel('padron-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'padron' }, handleChange)
  .subscribe();
```

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

## Seguridad

- **Anon Key** pública: Solo permisos `select`, `insert`, `update` en `padron` (configurar RLS en Supabase)
- **RLS Recomendado**:
  ```sql
  alter table padron enable row level security;
  
  create policy "Operadores pueden leer" on padron
    for select using (true);
    
  create policy "Operadores pueden insertar/actualizar" on padron
    for insert/update with check (true);
  ```
- Sin datos sensibles en frontend
- Validación de entrada en cliente y servidor

## Personalización

### Cambiar colores/theme
Editar clases Tailwind en `index.html`:
- Primario: `green-600` → `blue-600`, `purple-600`, etc.
- Estados: `green-50`/`red-50`/`amber-50` para tarjetas

### Agregar campos al padrón
1. Alterar tabla Supabase
2. Actualizar `demoData` estructura (línea ~277)
3. Modificar `importExcel()` upsert (línea ~1127)
4. Ajustar `showResultCanRegister()` / `showResultRegistered()`

### Tamaño de lote importación
```javascript
const batchSize = 500; // línea ~1087
```

## Licencia

MIT License - Uso libre para fines electorales, educativos y cívicos.

## Soporte

- Issues: [GitHub Issues](https://github.com/starnicosvv/Plataforma-de-Automatizaci-n-para-confirmaci-n-de-votos/issues)
- Documentación Supabase: [supabase.com/docs](https://supabase.com/docs)
- SheetJS: [sheetjs.com](https://sheetjs.com)

---

**Desarrollado para procesos electorales transparentes y auditables** 🗳️