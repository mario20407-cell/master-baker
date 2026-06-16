# Guía de configuración — Bot WhatsApp Marquéz

## Datos ya obtenidos ✅
- App ID: 982770894647747
- Phone ID: 1215513598308891  
- Business ID: 1347081764048616

## Paso 1 — Configurar el .env del backend

Abre `backend/.env` y agrega:

```
WHATSAPP_PHONE_ID=1215513598308891
WHATSAPP_TOKEN=EAAxxxxxxx...   ← pegar el token generado
WHATSAPP_VERIFY_TOKEN=marquez_verify_2024
OPENAI_API_KEY=sk-proj-...     ← para que el bot use GPT-4 mini
```

## Paso 2 — Exponer el backend a internet (ngrok)

El webhook de Meta necesita una URL pública. Usa ngrok para esto:

### Instalar ngrok
1. Ve a https://ngrok.com y crea cuenta gratis
2. Descarga ngrok para Windows
3. Ejecuta en CMD:
```
ngrok http 3001
```
4. Copia la URL que aparece, ejemplo:
```
https://abc123.ngrok-free.app
```

## Paso 3 — Configurar el webhook en Meta Developers

1. Ve a: developers.facebook.com/apps/982770894647747/whatsapp-business/wa-dev-console/
2. Clic en "Configuración" en el menú izquierdo
3. Busca la sección "Webhook"
4. Clic en "Editar"
5. URL del webhook:
```
https://abc123.ngrok-free.app/api/whatsapp/webhook
```
6. Token de verificación:
```
marquez_verify_2024
```
7. Clic en "Verificar y guardar"
8. Activa el evento: **messages**

## Paso 4 — Probar el bot

1. Arranca el backend: `npm run dev` en la carpeta backend
2. Arranca ngrok: `ngrok http 3001`
3. Envía un mensaje al número de prueba de Meta: **+1 555 677 1905**
4. El bot debe responder automáticamente

## Paso 5 — Agregar tu número real (producción)

Para usar tu número real de Marquéz:
1. En Meta Developers → WhatsApp → Números de teléfono
2. Clic en "Agregar número de teléfono"
3. Sigue el proceso de verificación con tu número nicaragüense
4. Actualiza WHATSAPP_PHONE_ID con el nuevo ID

## Endpoints disponibles

- GET  /api/whatsapp/status          → estado del bot
- POST /api/whatsapp/enviar          → enviar mensaje manual
- GET  /api/whatsapp/webhook         → verificación Meta
- POST /api/whatsapp/webhook         → recibir mensajes
- GET  /api/whatsapp/conversacion/:tel → ver historial
- DELETE /api/whatsapp/conversacion/:tel → limpiar historial

## Notas importantes

- El token temporal expira cada 24 horas en modo prueba
- En modo prueba solo puedes enviar a 5 números verificados
- Para producción necesitas que Meta apruebe la app (proceso de revisión)
- ngrok cambia de URL cada vez que lo reinicias — actualiza el webhook
- Para producción usa Railway/Render que dan URL permanente
