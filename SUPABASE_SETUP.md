# Configuración de cuentas y datos en la nube

La v15 usa Supabase Auth + PostgreSQL con Row Level Security (RLS). Cada usuario tiene una fila propia en `user_app_data` y solo puede leer/escribir su propia información.

## 1. Crear proyecto

En Supabase crea un proyecto y copia:
- Project URL
- Publishable/anon key

Pégalos en `supabase-config.js`.

**Nunca pongas una `service_role` key en el frontend.**

## 2. Crear la tabla

Ejecuta este SQL en el SQL Editor de Supabase:

```sql
create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

create policy "users can read own data"
on public.user_app_data for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own data"
on public.user_app_data for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own data"
on public.user_app_data for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 3. Correo de confirmación

En Authentication > Providers > Email configura la política que quieras. Para una app personal puedes desactivar temporalmente la confirmación durante las pruebas; para producción es recomendable mantenerla activa.

## 4. Qué ocurre con los datos actuales

Al crear la primera cuenta en este navegador, la aplicación intenta migrar los datos locales actuales a esa cuenta. Al iniciar sesión posteriormente, la versión cloud es la fuente de verdad.

Los usuarios distintos no comparten la misma fila porque `user_id` viene de `auth.users` y RLS impide acceder a los datos de otra cuenta.

## 5. Probar

1. Abre la aplicación después de completar `supabase-config.js`.
2. Crea una cuenta.
3. Crea un gasto y recarga la página.
4. Cierra sesión.
5. Inicia sesión con otra cuenta: no debe aparecer el gasto de la primera cuenta.
6. Vuelve a la primera cuenta: sus datos deben aparecer.

## Seguridad

El frontend usa únicamente la clave pública/anon de Supabase. La protección real depende de RLS. No desactives RLS en `user_app_data` y no pongas una `service_role` key en ningún archivo que se entregue al navegador.
