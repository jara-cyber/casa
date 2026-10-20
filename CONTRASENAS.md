# Cambiar contraseñas desde Casa

## Tu propia cuenta
Entra en Administración web → Usuarios, busca tu correo y pulsa Cambiar contraseña.
Confirma tu correo y escribe dos veces la nueva contraseña (12–128 caracteres).
Este cambio usa tu sesión actual y no necesita desplegar casa-admin ni enviar correos.
La contraseña anterior no se puede ver. Si Supabase tiene activada la verificación adicional para cambios de contraseña, puede exigir reautenticación.

## Otras cuentas
Una sola vez, en el proyecto Supabase:
1. Edge Functions → crea una función llamada exactamente casa-admin.
2. Pega TODO supabase/functions/casa-admin/index.ts en su archivo index.ts.
3. Despliega y desactiva Verify JWT with legacy secret para ESA función.
La autorización se comprueba dentro del código: valida la sesión y verifica el UUID en site_admins antes de llamar al método administrativo.
SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se suministran automáticamente en el servidor. Nunca las copies al frontend, GitHub ni al chat.
No hace falta ejecutar de nuevo schema.sql ni la migración del propietario.

Alternativa CLI autenticada:
```sh
supabase functions deploy casa-admin --project-ref djvvptophxqwqcadkahj --no-verify-jwt
```

Después, Administración web → Usuarios → Cambiar contraseña junto al usuario.
Escribe exactamente su correo y la nueva contraseña dos veces.
Facilítasela personalmente: la web no manda ningún correo. Casa le pedirá elegir otra al entrar; esto es un aviso de la aplicación y no debe confundirse con revocar inmediatamente todas las sesiones ya abiertas.
El cambio no confirma correos pendientes ni concede roles de administrador.
Solo el propietario global de Casa puede cambiar contraseñas ajenas. Un administrador familiar no tiene ese permiso.
Cada propietario solo puede cambiar la suya; no la de otro propietario.

## Si olvidas tu contraseña de propietario
Mientras conserves una sesión abierta en un móvil u ordenador, puedes usar el botón de tu propia cuenta sin conocer la anterior.
Si has perdido todas las sesiones, este panel no puede identificarte. Usa recuperación por correo o el acceso administrativo verificado a tu proyecto Supabase. No existe un botón público para cambiar la contraseña del propietario sin acreditar acceso.
No ejecutes SQL con contraseñas ni las incluyas en enlaces.

## Verificación
GitHub Actions prueba rechazo de sesiones inválidas, miembros sin permiso, correos de confirmación incorrectos, contraseñas inválidas y cambios de privilegios durante la operación; comprueba protección de otros propietarios y compila la función con Deno.
El despliegue de GitHub Pages no despliega funciones de Supabase. Hasta instalar casa-admin, solo funcionará el cambio de la propia cuenta.
