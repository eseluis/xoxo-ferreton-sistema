# Activacion de seguridad de XOXO Ferreton

La version local ya usa sesiones reales de Supabase. La limpieza inicial ya fue realizada el 21 de agosto de 2026; el archivo de migracion queda seguro para futuras actualizaciones y no vuelve a borrar registros. No publicar hasta completar estos pasos y probar al menos una cuenta directiva y una cuenta operativa.

La limpieza inicial afecta solamente registros operativos. Los colaboradores, puestos, jerarquias, turnos, horarios, actividades programadas y rol de limpieza se consideran estructura maestra y deben conservarse. Pueden reconstruirse desde `scripts/export-structure.cjs`.

## 1. Respaldar los datos

En Supabase, exportar la tabla `app_state` o crear un respaldo del proyecto antes de ejecutar la migracion.

## 2. Ejecutar la migracion

Abrir **Supabase > SQL Editor**, pegar el contenido completo de `supabase-setup.sql` y ejecutarlo. Esto:

- elimina el acceso anonimo;
- crea perfiles vinculados a usuarios autenticados;
- conserva la tabla actual `app_state`;
- registra cada alta, cambio y eliminacion en `audit_log`.

## 3. Crear usuarios

En **Authentication > Users**, crear cada usuario con un correo interno siguiendo este formato:

`NUMERO@usuarios.xoxo-ferreton.local`

Ejemplo para el colaborador 003:

`003@usuarios.xoxo-ferreton.local`

Asignar una contrasena individual de al menos 12 caracteres. No reutilizar el numero, nombre, telefono ni la contrasena anterior. En los metadatos del usuario agregar:

```json
{ "employee_number": "003" }
```

## 4. Vincular el perfil

Despues de crear el usuario, ejecutar una insercion como esta, ajustando los valores:

```sql
insert into public.profiles (user_id, employee_number, display_name, role, branch)
select id, '003', 'Nombre del colaborador', 'GERENTE_GENERAL', 'Matriz'
from auth.users
where email = '003@usuarios.xoxo-ferreton.local';
```

Roles permitidos por la aplicacion:

- `APODERADA_LEGAL`
- `DIRECTOR`
- `GERENTE_GENERAL`
- `ADMIN_GENERAL`
- `GERENTE_TIENDA`
- `ADMIN_TIENDA`
- `JEFE_AREA`
- `CAJERO`
- `AUXILIAR`

## 5. Probar antes de publicar

1. Iniciar sesion con numero y contrasena nuevos.
2. Confirmar que no aparece la lista de colaboradores en el acceso.
3. Registrar una operacion de prueba.
4. Confirmar el cambio en `app_state` y su entrada correspondiente en `audit_log`.
5. Cerrar sesion y verificar que el panel deja de estar disponible.

## Importante

La llave publica de Supabase puede estar en el navegador; la seguridad depende de las politicas RLS y de sesiones autenticadas. Nunca colocar la `service_role` en `.env`, Vercel ni en el codigo del navegador.
