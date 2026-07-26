# 📓 Registro de Errores Conocidos y Parches - Master Baker (marquez-app)

Este archivo sirve como memoria histórica de fallos, bugs de regresión y parches aplicados en el sistema Master Baker.
Antes de diagnosticar un error desde cero, revisa si existe un patrón coincidente en esta lista.

---

## 📅 Estructura de Registro

Cada nueva entrada debe seguir esta plantilla:

```text
### [YYYY-MM-DD] - BREVE DESCRIPCIÓN DEL ERROR
- **Síntoma / Mensaje de Error:** Excepción o comportamiento anómalo.
- **Componente Afectado:** (Ej. `backend/mcp/server.py`, `database/rls.sql`, `frontend/Calculadora.tsx`)
- **Causa Raíz:** Por qué ocurrió el fallo.
- **Solución / Fix Aplicado:** Breve explicación del parche y archivo corregido.
- **Instrucciones para Verificar Regresión:** Cómo comprobar si el bug volvió a aparecer.
```

---

## Entradas

### [2026-07-26] - Bot de WhatsApp no respondía a mensajes reales (access_token vencido)
- **Síntoma / Mensaje de Error:** El webhook de WhatsApp recibía los mensajes entrantes con normalidad (POST 200, log `[WhatsApp] Mensaje de <número>: "..."`), pero el bot nunca contestaba. Los logs de Railway mostraban, inmediatamente después de cada mensaje recibido: `[WhatsApp] Error al enviar: { error: { message: 'Authentication Error', code: 190, type: 'OAuthException' } }`.
- **Componente Afectado:** `tenant_whatsapp_config.access_token` (tabla en Supabase/producción); función `enviarMensaje` en `backend/src/routes/whatsapp.js`.
- **Causa Raíz:** El `access_token` guardado para el tenant de Marquéz era un token vencido — se había rotado previamente (task #73) usando el flujo por defecto de Meta, que genera un token de corta duración (temporal, vence en horas/días) en vez de un token de usuario del sistema (System User) de larga duración. Falsa pista inicial: se sospechó que la app de Meta "sin publicar" bloqueaba la entrega de webhooks — descartado con evidencia en logs (los webhooks, tanto reales como el de prueba de Meta, sí llegaban sin problema; el fallo era exclusivamente al enviar la respuesta).
- **Solución / Fix Aplicado:** Se generó un token nuevo desde Meta Business Settings → Usuarios del sistema, usando el usuario de sistema ya existente (`Mario_Leiva`) con los 4 permisos necesarios (`manage_app_solution`, `whatsapp_business_manage_events`, `whatsapp_business_management`, `whatsapp_business_messaging`) y caducidad **"Nunca"**. Se actualizó `tenant_whatsapp_config.access_token` en producción vía script puntual (no commiteado, token pasado solo por variable de entorno, script borrado después de usar) — mismo patrón que `migrar_whatsapp_marquez.js`.
- **Instrucciones para Verificar Regresión:** Mandar un mensaje real por WhatsApp al número de Marquéz y confirmar dos cosas: (1) en el chat de WhatsApp llega una respuesta del bot; (2) en los logs de Railway (`Deploy Logs` del servicio `master-baker`) aparece `[WhatsApp] Respuesta enviada a <número>` sin ningún `[WhatsApp] Error al enviar` ni `OAuthException` inmediatamente después del mensaje recibido. Si vuelve a aparecer `code: 190, type: 'OAuthException'`, el token se revocó o venció — confirmar primero en Meta Business Settings → Usuarios del sistema → Marquez-bot que el token siga activo antes de generar uno nuevo.
