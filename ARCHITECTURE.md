1. Flujo de Datos (The Pipeline)
Ingesta: Los PDFs llegan vía Webhook (WhatsApp/API).

Orquestación: El QueueManager recibe la tarea y la encola.

Procesamiento: El AIProcessor selecciona el motor (Gemini/Claude/DeepSeek) basado en la complejidad de la tarea.

Persistencia: Los datos estructurados se guardan en Supabase mediante el DatabaseClient.

Notificación: El sistema notifica el resultado al usuario final.

2. Estructura de Módulos (Separación de Responsabilidades)
/api: Solo maneja las peticiones HTTP y validación de entrada (Controladores).

/services: Contiene la lógica de negocio pura (Servicios).

/services/ai: Adaptadores unificados para los 4 motores.

/services/db: Interacción con Supabase.

/workers: Tareas en segundo plano (procesamiento de PDFs pesados).

/utils: Funciones helper (formateo de moneda, limpieza de texto).

3. Principios de Diseño
DRY (Don't Repeat Yourself): No duplicar lógica de IA. Todo pasa por el AIProvider.

Single Responsibility: Un archivo, una tarea. Si un archivo supera las 300 líneas, debe ser refactorizado.

Robustez: Toda petición a la base de datos debe envolverse en bloques try/catch con logs de error descriptivos.