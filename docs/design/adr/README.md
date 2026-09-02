# ADRs — decisiones de arquitectura del propio sistema

Registradas en el mismo formato que el sistema le exigirá al Agente
Arquitecto para los proyectos que gestione (ver
[§3 Contrato de cada agente](../03-arquitectura-diseno.md#3-contrato-de-cada-agente),
regla RF-14): título, estado, contexto, decisión, RNF relacionados,
alternativas consideradas y consecuencias.

| ADR | Decisión |
|---|---|
| [0001](./0001-persistencia-relacional.md) | Persistencia relacional (PostgreSQL) para el modelo de dominio |
| [0002](./0002-cola-de-trabajos-agentes.md) | Cola de trabajos para la ejecución asíncrona de agentes |
| [0003](./0003-chat-tiempo-real-websocket.md) | WebSocket para el chat en vivo |
| [0004](./0004-abstraccion-proveedor-ia.md) | Capa de abstracción de proveedor de IA |
