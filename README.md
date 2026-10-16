# Casa · En familia

Una sola web para la familia: GitHub Pages muestra el panel y Supabase gestiona, por detrás, los usuarios y los datos. Los familiares se registran e inician sesión en Casa; no necesitan una cuenta de la plataforma Supabase ni visitar su panel.

Incluye resumen, tareas, agenda, lista de compra, menú, gastos, enlaces, espacio privado por cuenta y espacio familiar compartido. La primera persona que crea una familia es su administradora y puede invitar a los demás por correo y código.

## Estado

Código preparado para GitHub Pages en `jara-cyber/casa`. El proyecto Supabase ya está enlazado mediante su URL y clave pública en `src/public-config.json`. Falta verificar que el SQL se ejecutó y activar GitHub Pages. No hay una cuenta admin creada en un servidor todavía: se crea al registrar la primera cuenta y crear la familia. No hay credenciales predeterminadas en el código.

La versión anterior en ChatGPT sigue siendo independiente. El archivo `render.yaml` se ha retirado: esta versión no necesita Render.

## Configuración inicial del propietario (una sola vez)

### 1. Proyecto Supabase Free

1. En https://supabase.com/dashboard crea un proyecto **Free**, preferiblemente en Europa. No hace falta instalar ningún complemento de ChatGPT.
2. Abre SQL Editor, pega **todo** `supabase/schema.sql` y ejecútalo una vez en un proyecto nuevo. Crea tablas, permisos, invitaciones y reglas de privacidad.
3. En Authentication → Providers → Email, activa el registro y la confirmación del correo. Configura una contraseña mínima de 12 caracteres.
4. En Authentication → URL Configuration, usa la URL publicada de Casa como Site URL y añádela a Redirect URLs, con la ruta del repositorio y barra final. El formato esperado para este repositorio es `https://jara-cyber.github.io/casa/`; solo estará disponible cuando GitHub confirme la publicación.
5. Copia **Project URL** y la clave **Publishable** (`sb_publishable_...`) de la configuración del proyecto. No uses `sb_secret_...`, `service_role` ni la contraseña PostgreSQL en la web.

### 2. GitHub Pages

1. En GitHub Free, Pages requiere un repositorio público. Este repositorio actualmente se creó como privado: cambia su visibilidad desde Settings → General → Danger Zone si usas ese plan. El repositorio contiene código; los datos familiares se guardan en Supabase. Si tu plan admite Pages desde repositorios privados, puedes conservarlo privado.
2. La URL y clave pública ya están en `src/public-config.json`; no hace falta crear variables en GitHub. Si quieres sustituir esa configuración, las siguientes variables opcionales tienen prioridad:
   - `VITE_SUPABASE_URL`: Project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: clave pública `sb_publishable_...`.
3. En Settings → Pages, selecciona **GitHub Actions** como Source.
4. En Actions ejecuta **Publicar Casa en GitHub Pages**. El workflow comprueba configuración, pruebas y compilación antes de publicar. Los nuevos cambios en `main` se publicarán automáticamente.
5. Abre la URL devuelta por el despliegue cuando termine correctamente. El workflow valida la configuración pública antes de compilar.

## Administrador y miembros

1. En Casa pulsa **Crear una cuenta**, introduce tu correo y una contraseña propia y confirma el correo recibido.
2. Inicia sesión y crea tu familia. Esa cuenta obtiene el rol **Administrador** automáticamente.
3. En Familia, introduce nombre y correo de un familiar. Se genera un código de un uso que caduca en 7 días.
4. Comparte personalmente la URL de Casa y el código con ese familiar. No se envían invitaciones por email desde la app.
5. El familiar crea su cuenta en Casa con ese mismo correo, lo confirma y pulsa **Tengo una invitación**.
6. Cada persona elige **Mi espacio** o **En familia**. Al guardar una tarea o cita decide entre **Solo yo** y **Toda la familia**.

El administrador de la familia no recibe acceso a los registros privados ajenos a través de la app. Quien administra el proyecto Supabase sí mantiene acceso administrativo a su base de datos. Las contraseñas y sesiones las gestiona Supabase Auth.

Todos pueden marcar tareas y productos compartidos como completados; solo quien creó el registro puede borrarlo. Las invitaciones están ligadas al correo confirmado de su destinatario. Un usuario no puede leer datos de otra familia.

## Avisos

Activa los permisos en Avisos y ajustes. Los recordatorios del navegador se comprueban con la web abierta, con posibles retrasos si el navegador suspende la pestaña. No se ha implementado envío push con la web cerrada.

En Agenda, **Al calendario** exporta una cita `.ics` con alarma para recibir avisos desde el calendario del móvil. Comprueba que la aplicación conserve la alarma y tenga permiso de notificación. Los cambios y eliminaciones en Casa no se trasladan automáticamente al calendario.

## Copias y migración

Exporta una copia JSON desde Avisos y ajustes de la versión anterior. En esta versión puedes importar esa copia: los registros se añaden como personales para no compartirlos por accidente. Máximo 500 registros por copia. Repetir una importación duplica los registros; no se borra lo existente. No hay migración automática entre servidores o dominios.

## Desarrollo

Requiere Node 22.13 o posterior.

```sh
npm ci
cp .env.example .env.local
# Rellena la URL y clave pública en .env.local.
npm run dev
```

`npm test` comprueba permisos en PostgreSQL mediante PGlite: separación de familias, datos privados, invitaciones, acceso anónimo y operaciones compartidas. `npm run build` comprueba TypeScript y genera `dist/`.

Sin configuración local, la aplicación muestra una explicación y no acepta contraseñas. No se deben incluir secretos, contraseñas, copias de datos ni `.env.local` en GitHub.

## Coste

Preparado para GitHub Pages y Supabase Free, sin activar planes de pago. Ambos tienen límites. Supabase Free puede pausar el proyecto tras una semana de inactividad. El correo de confirmación y recuperación está sujeto a límites; para un uso más amplio podría requerir SMTP.

Documentación oficial:
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/api-keys

## Asistente en la esquina inferior derecha

El botón «Pregúntale a Casa» abre un chat. El modo predeterminado **Consultas de Casa** no usa una IA: interpreta consultas de agenda, tareas, compras, menú y gastos, y responde a partir de registros actuales. Por ejemplo: «¿Qué tengo mañana?», «¿Qué falta por comprar?» o «Gastos de familia». Cada pregunta vuelve a consultar el servidor. No crea ni modifica registros y no responde con una copia antigua si falla la conexión.

En los ajustes del chat puedes seleccionar **IA local · Ollama**, indicar un modelo local instalado y su dirección loopback, por defecto `http://localhost:11434`. Solo al preguntar envía a ese servicio la pregunta y los registros relacionados visibles para tu cuenta; no envía correos, claves ni contraseñas. El historial no se guarda y se borra al cerrar la sesión. Si falla Ollama, se muestra la consulta directa, identificada como tal. Las respuestas del modelo pueden contener errores.

Para conectar Ollama, permite el origen exacto de la web con `OLLAMA_ORIGINS` y activa `OLLAMA_NO_CLOUD=1`; reinicia Ollama y conserva la escucha en localhost. Configuración documentada: https://docs.ollama.com/faq. El navegador puede bloquear o pedir permiso para conexiones locales. En un móvil, localhost apunta al móvil, no a tu PC. La conexión real depende de tener Ollama y el modelo ejecutándose en ese dispositivo; no se ha verificado con tu ordenador.
