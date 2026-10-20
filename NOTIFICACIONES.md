# Notificaciones con Casa cerrada

El código de la aplicación no basta: hay que instalar el envío en el proyecto Supabase existente, una sola vez. No se requiere otro servicio de notificaciones ni instalar complementos en ChatGPT.

## 1. Base de datos
Abre supabase/push.sql en este repositorio, copia TODO el contenido y ejecútalo en Supabase → SQL Editor. Es una migración adicional: no vuelvas a ejecutar schema.sql. El aviso de operaciones destructivas corresponde a reemplazar políticas; no borra cuentas, familias ni registros.

Crea suscripciones privadas por cuenta, cola de recordatorios y un cron cada minuto. El cron no envía nada hasta activar el servidor. Puedes volver a ejecutar push.sql.

## 2. Función de envío
En Supabase → Edge Functions crea una función llamada exactamente casa-push.
Pega TODO el contenido de supabase/functions/casa-push/index.ts y despliega.
En la configuración de ESA función desactiva “Verify JWT with legacy secret”.
La función valida dentro de su código el inicio de sesión para activar/probar y un token secreto para los envíos programados. Desactivar esa comprobación de la plataforma no permite enviar avisos sin autorización.

Alternativa con Supabase CLI ya autenticada:
```sh
supabase functions deploy casa-push --project-ref djvvptophxqwqcadkahj --no-verify-jwt
```
SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son variables automáticas de la función alojada. No las copies a GitHub, al navegador ni al chat.

## 3. Activación y prueba
En Casa inicia sesión como propietario y abre Avisos y ajustes → Activar servidor de avisos.
Las claves VAPID se generan en el servidor, se guardan protegidas y se conservan entre despliegues.
Cada miembro pulsa Activar en este dispositivo. En iPhone/iPad (iOS 16.4+) primero abre Casa en Safari → Compartir → Añadir a pantalla de inicio, y entra desde el icono.
Pulsa Enviar prueba (máximo una por minuto).
Crea una cita para dentro de unos minutos, elige “A la hora”, cierra Casa y comprueba que llega el aviso. Verifica también una cita privada con otra cuenta: no debe llegarle.
En ajustes, “Última comprobación del servidor” debe actualizarse después de activar el cron. Compruébalo tras unos minutos.

## Comportamiento
- Se envían recordatorios de Agenda. Todavía no hay avisos instantáneos de compras ni tareas.
- Citas familiares: cada dispositivo suscrito de los miembros actuales de esa familia. Privadas: solo dispositivos del propietario de la cita.
- La fecha de la cita se guarda en UTC desde la hora local elegida; el envío no depende de la zona horaria del servidor.
- Se revisa cada minuto. Reintentos de fallos temporales hasta cinco veces, con cinco minutos de espera. Suscripciones caducadas (404/410) se eliminan.
- Un registro por dispositivo/cita/fecha/antelación evita duplicados habituales. Si el proveedor acepta un envío y falla la confirmación de base de datos, puede repetirse.
- Los mensajes no incluyen título, médico, fechas ni otros datos personales; al abrir Casa se exige sesión para consultar detalles.
- Cerrar sesión desactiva los avisos de ese dispositivo; volver a entrar requiere activarlos de nuevo. Si se cierra sesión sin conexión, se muestra un error para evitar dejar avisos de la cuenta anterior.
- No se guardan datos privados en caché. La instalación no implica funcionamiento sin conexión.
- La entrega depende de conexión, permisos, ajustes del móvil, límites y disponibilidad del proyecto Supabase y del proveedor push. No es una alarma garantizada.
- El script de envío revisa citas vigentes cuyo recordatorio venció en las últimas 24 horas; no manda avisos de citas ya pasadas.
- No publiques claves privadas ni endpoints. La clave pública VAPID sí se entrega al usuario autenticado.
- Para parar los envíos: Supabase → Cron → pausa casa-push-every-minute. Para un solo móvil, usa Desactivar en este dispositivo.

## Validación
GitHub Actions ejecuta las pruebas de PostgreSQL sobre privacidad, destinatarios, reintentos y deduplicación y compila el frontend. El despliegue de Pages no instala la migración ni la función en Supabase.
