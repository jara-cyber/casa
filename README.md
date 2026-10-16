# Casa · En familia

Panel familiar independiente de ChatGPT. Frontend React y Vite preparado para Render; cuentas con correo y contraseña y datos en Supabase. Incluye tareas, agenda, compras, menú semanal, gastos, enlaces, espacios personales y familiares, invitaciones y exportación de datos.

## Estado de esta entrega

Código preparado para publicar. El repositorio de destino es `jara-cyber/casa`. Falta crear y configurar el proyecto Supabase; no se han migrado datos del sitio anterior. La versión alojada en ChatGPT sigue siendo independiente. El sitio de GitHub solo funcionará con datos reales al completar la configuración siguiente.

## 1. Base de datos y cuentas (sin instalar complementos)

1. En https://supabase.com/dashboard crea un proyecto con el plan Free, preferiblemente en una región europea. Conserva la contraseña de la base de datos en tu gestor; la web no la necesita.
2. Abre SQL Editor, pega el contenido completo de `supabase/schema.sql` y ejecútalo una vez en ese proyecto nuevo.
3. En Authentication activa el proveedor Email, el registro de usuarios y la confirmación del correo. Configura una longitud mínima de contraseña de 12 caracteres.
4. En Authentication → URL Configuration, cuando tengas la URL publicada de GitHub Pages, úsala como Site URL y añádela a Redirect URLs. Incluye la ruta del repositorio y la barra final, por ejemplo `https://TU-USUARIO.github.io/casa/`.
5. Copia Project URL y la clave **publishable** desde la configuración del proyecto. Son configuración pública del cliente. Nunca uses la clave `service_role`, una clave `sb_secret_...` ni la contraseña de PostgreSQL.

Supabase gestiona contraseñas y sesiones; la aplicación no las almacena. Las políticas de PostgreSQL limitan cada consulta: un usuario solo ve registros de su familia y sus propios registros privados. Ni el administrador de la familia puede leer los privados ajenos a través de la aplicación. El propietario del proyecto Supabase conserva acceso administrativo a su base de datos.

## 2. Publicar en Render

El código está preparado para el repositorio privado `jara-cyber/casa`. No hace falta hacerlo público para esta opción.

1. En https://dashboard.render.com elige New → Blueprint y conecta ese repositorio. Usa `render.yaml` de la rama `main`.
2. El Blueprint declara un Static Site, sin servidor ni base de datos de pago en Render. Introduce `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` cuando Render las solicite.
3. Publica y espera al estado Live. Render mostrará la URL real terminada en `.onrender.com`; no hay una URL reservada de antemano.
4. Añade esa URL con barra final tanto a Site URL como a Redirect URLs en Supabase Authentication, en lugar del ejemplo de GitHub Pages de la sección anterior.
5. Los cambios en `main` se volverán a publicar automáticamente. `npm test` y `npm run build` se ejecutan antes de publicar.

Si usas New → Static Site en lugar de Blueprint, configura:

- Repositorio: `jara-cyber/casa`, rama `main`.
- Build Command: `npm ci && npm test && npm run build`.
- Publish Directory: `dist`.
- Variables: `NODE_VERSION=22.22.0`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

Sin la configuración de Supabase, el sitio muestra una pantalla de configuración; no permite iniciar sesión ni acepta datos. Publicar esa pantalla no equivale a tener las cuentas activas.

## GitHub Pages como alternativa

También puedes usar GitHub Pages. En GitHub Free necesitarías un repositorio público; no es necesario para Render. La configuración automática de esta entrega se dirige a Render.

## 3. Primera entrada y familia

1. Crea tu cuenta en la web y confirma el correo.
2. Inicia sesión y elige crear una familia: tu cuenta será la administradora.
3. En Familia, escribe el nombre y correo de un familiar y crea la invitación.
4. Comparte personalmente con él la URL de la web y el código generado. La aplicación no envía invitaciones por email.
5. Esa persona crea su cuenta usando el mismo correo, lo confirma y elige «Tengo una invitación». El código es de un uso, caduca a los 7 días y solo sirve para ese correo.
6. Cada miembro tiene «Mi espacio» y «En familia». Puede marcar tareas y productos compartidos como completados; solo el creador puede eliminar un registro.

## Recordatorios

La app solicita permiso de notificaciones solo al pulsar el botón de activación. Los avisos se comprueban cada 30 segundos con la página abierta; un navegador suspendido puede retrasarlos. No existe todavía un servicio de envío push con la página cerrada.

Para avisos con la web cerrada, cada cita permite descargar un archivo `.ics` con alarma e importarlo en el calendario del móvil. Revisa que tu aplicación conserve la alarma y tenga permiso para notificar. Cambiar o borrar una cita aquí no modifica automáticamente una copia ya importada al calendario.

## Datos anteriores

La web exporta una copia JSON de los registros visibles. Exporta una copia JSON desde Avisos y ajustes de la versión ChatGPT y elige Importar una copia JSON en esta versión. Se añaden como personales para no compartirlos accidentalmente, sin borrar lo existente. No repitas la importación: duplicaría los registros. Máximo 500 registros por copia. Los datos locales antiguos solo pueden detectarse en su dominio original; un sitio de GitHub no puede leer el almacenamiento local de un sitio de ChatGPT.

## Desarrollo

Requiere Node 22.13 o posterior.

```sh
npm ci
cp .env.example .env.local
# Rellena la URL y clave pública en .env.local.
npm run dev
```

`npm test` ejecuta las pruebas de permisos en PostgreSQL mediante PGlite. `npm run build` comprueba TypeScript y genera `dist/`. El despliegue también ejecuta ambas comprobaciones. Sin configuración de Supabase, la web muestra una pantalla de configuración; no acepta credenciales ni inventa datos.

## Coste y límites

Se ha diseñado para un Static Site de Render y Supabase Free. No se ha contratado ni activado ningún plan de pago. Los límites y condiciones de ambos proveedores pueden cambiar. Supabase Free puede pausar el proyecto tras una semana de inactividad. El correo de confirmación y recuperación está sujeto a los límites del proveedor; para uso más amplio puede requerirse configurar SMTP.

Documentación:
- https://render.com/docs/static-sites
- https://render.com/docs/blueprint-spec
- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/api-keys
