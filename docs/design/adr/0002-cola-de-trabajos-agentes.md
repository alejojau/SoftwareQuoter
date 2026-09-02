# ADR-0002: Cola de trabajos para la ejecución asíncrona de agentes

**Estado:** Aceptado

## Contexto

Cada agente (Elicitador, Legal, Mercado, Analista, Alcance, Arquitecto,
Generador de Cotización) corre como una unidad de trabajo independiente que
puede tardar (llamadas a un LLM, búsquedas web) y que no debe bloquear a
otros agentes del mismo proyecto sin dependencia directa (RNF-07), ni
degradar el sistema cuando crece el número de proyectos activos en paralelo
(RNF-09, RF-01). Además, cuando ocurre un `ChangeEvent`, el motor evolutivo
puede necesitar encolar la regeneración de varios documentos a la vez.

## Decisión

Usar una **cola de trabajos** (Redis + BullMQ, o equivalente) donde cada
ejecución de agente es un job independiente, con reintentos ante fallo
transitorio y con capacidad de encolar múltiples jobs desde una sola
invalidación (uno por cada `DocumentNode` marcado `obsoleto`). El propio
sistema aplica así el mismo patrón que su Agente Arquitecto recomendaría a
un proyecto externo con requerimientos de concurrencia — coherencia directa
entre lo que la plataforma predica y lo que practica.

## RNF relacionados

- RNF-07 (resiliencia del pipeline): un agente bloqueado en
  `esperando_respuesta` no ocupa el mismo hilo/proceso que otro agente
  listo para avanzar.
- RNF-09 (escalabilidad de ejecución): los workers que consumen la cola
  escalan horizontalmente de forma independiente al servidor web/chat.

## Alternativas consideradas

- **Ejecución síncrona dentro del request HTTP/WebSocket:** descartada —
  no soporta múltiples proyectos avanzando en paralelo sin degradar
  latencia del chat (RNF-03), y una llamada larga a un LLM bloquearía la
  conexión del usuario.
- **Cron/polling periódico sobre una tabla de "pendientes":** descartado
  por la latencia que introduce (RNF-03 exige reflejar eventos en
  segundos, no en el intervalo del polling).

## Consecuencias

- Se gana desacople entre la capa de chat/API y la ejecución de agentes, y
  resiliencia ante fallos transitorios (reintentos).
- Se añade una pieza de infraestructura adicional (Redis) y la necesidad de
  monitorear la cola (jobs atascados, dead-letter para fallos persistentes).
