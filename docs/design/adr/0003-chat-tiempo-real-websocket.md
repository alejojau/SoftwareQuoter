# ADR-0003: WebSocket para el chat en vivo

**Estado:** Aceptado

## Contexto

La elicitación y la revisión de documentos ocurren en un chat en vivo
(RF-03) con potencialmente varios participantes humanos simultáneos por
proyecto (los tres roles) más eventos generados por los agentes
(RF-20: indicadores de "generando", tarjetas de `esperando_respuesta`,
timeline de actividad del motor evolutivo). Los mensajes y eventos deben
reflejarse en la interfaz de todos los participantes conectados en tiempo
cercano a real.

## Decisión

Usar **WebSocket** (ej. socket.io sobre el backend Node/Express existente)
como canal de transporte del chat, con una sala (`room`) por proyecto.
Tanto los mensajes de usuario como los eventos de sistema (nueva versión
generada, documento invalidado, pregunta bloqueante) se emiten por el mismo
canal, como distintos tipos de evento.

## RNF relacionados

- RNF-03 (latencia del chat): WebSocket evita el overhead de polling HTTP
  repetido para lograr una experiencia de segundos, no minutos.
- RNF-08 (disponibilidad de preguntas pendientes): el mismo canal notifica
  en tiempo real cuando aparece una pregunta bloqueante, alimentando la
  bandeja de pendientes de Workspace.

## Alternativas consideradas

- **Polling HTTP periódico:** descartado — no cumple la latencia esperada
  de RNF-03 sin aumentar drásticamente la frecuencia de polling (y con
  eso, la carga del backend).
- **Server-Sent Events (SSE):** válido para eventos unidireccionales
  (servidor → cliente), pero el chat necesita también mensajes del usuario
  hacia el servidor con baja latencia y presencia (quién está escribiendo),
  lo que encaja mejor con un canal bidireccional.

## Consecuencias

- Se gana una experiencia de chat verdaderamente en vivo, incluyendo
  presence y notificación inmediata de eventos del motor evolutivo.
- Se añade complejidad de manejo de estado de conexión (reconexión,
  salas por proyecto, escalado del servidor de WebSocket detrás de balanceo
  de carga si el número de conexiones concurrentes crece).
