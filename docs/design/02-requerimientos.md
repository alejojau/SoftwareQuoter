# 2. Requerimientos

Prioridad según MoSCoW: **M**ust (indispensable para el MVP), **S**hould
(deseable en el MVP, postergable si hay presión de tiempo), **C**ould (fase
2+). Cada fila referencia, cuando aplica, la sección de
[Arquitectura y diseño](./03-arquitectura-diseno.md) que lo implementa.

## 2.1 Requerimientos funcionales

### Workspace y proyectos

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-01 | El sistema permite crear, pausar y retomar múltiples proyectos en paralelo dentro de un Workspace, sin interferencia entre ellos. | M | §1 Modelo de dominio |
| RF-02 | Un usuario puede tener distintos roles (Negocio, Analista, Arquitecto) en distintos proyectos, y más de un rol en el mismo proyecto. | M | §5 Roles y aprobación |

### Elicitación

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-03 | El sistema conduce una conversación en chat en vivo para producir un Business Brief, cubriendo como mínimo: objetivo, usuarios finales, dominio/industria, país/región, restricciones conocidas. | M | §3 Contrato de agentes (Elicitador) |
| RF-04 | El Business Brief no pasa a estado revisable hasta cubrir esa checklist mínima. | M | §2 Estados |

### Cobertura proactiva de vacíos (entrevista dirigida por impacto)

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-23 | Antes de dar su documento por completo, cada agente (no solo el Elicitador) identifica explícitamente qué aspectos relevantes de su alcance quedaron sin especificar o ambiguos, no solo lo que el usuario mencionó espontáneamente. | M | §3.3 Cobertura proactiva de vacíos |
| RF-24 | Cada vacío identificado se clasifica por impacto estimado en el resto del pipeline (alto/medio/bajo). Los de impacto alto se preguntan de forma bloqueante, los de impacto medio de forma aclaratoria, y solo los de impacto bajo se resuelven con un supuesto documentado sin interrumpir al usuario. | M | §3.3 |

### Investigación legal y de mercado

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-05 | El sistema identifica normativa potencialmente aplicable según el país/industria declarados en el Brief (configurable por proyecto, no fijo). | M | §3.2 Reglas del agente Legal |
| RF-06 | Cada hallazgo legal se presenta con fuente primaria verificable (enlace), fecha de consulta y nivel de confianza; sin fuente confirmable se marca explícitamente como "sin confirmar". | M | §3.2 |
| RF-07 | Ante fuentes legales contradictorias, el sistema no decide unilateralmente: marca el hallazgo como conflicto, cita ambas fuentes y recomienda validación humana. | M | §3.2 |
| RF-08 | La normativa nacional y la local/municipal se acumulan (no se reemplazan); la local solo se evalúa si el Brief tiene precisión de ubicación suficiente. | M | §3.2 |
| RF-09 | El sistema identifica software existente que resuelva necesidades iguales o similares, con fuente por cada hallazgo. | M | §3 Contrato de agentes (Mercado) |

### Requerimientos y alcance

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-10 | El sistema consolida Brief + hallazgos legales + hallazgos de mercado + peticiones directas del usuario final (capturadas en el chat) en un documento de Requerimientos (historias de usuario, FR/NFR). | M | §3 (Analista) |
| RF-11 | Cada restricción regulatoria en Requerimientos cita el hallazgo legal concreto que la origina. | M | §3 (Analista) |
| RF-12 | El sistema define un alcance por fases (MVP vs. alcance completo) a partir de los Requerimientos aprobados. | M | §3 (Alcance/Estimador) |

### Arquitectura y estimación

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-13 | El sistema propone una arquitectura técnica basada en los requerimientos no funcionales (concurrencia, disponibilidad, carga esperada), no solo en preferencia genérica. | M | §3 (Arquitecto) |
| RF-14 | Toda decisión de arquitectura "grande" (stack, patrón arquitectónico, colas, balanceo, orquestación de contenedores, base de datos) queda registrada como un ADR que cita los RNF que la motivaron y las alternativas descartadas. | M | §3 (Arquitecto) |
| RF-15 | El sistema calcula una estimación de costo/tiempo a partir del alcance y la arquitectura aprobados. | M | §3 (Generador de Cotización) |

### Motor evolutivo

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-16 | Cuando un documento cambia, el sistema invalida automáticamente todo documento dependiente aguas abajo, sin borrar las versiones anteriores. | M | §4 Motor evolutivo |
| RF-17 | Un documento invalidado que ya estaba aprobado por un humano no se regenera automáticamente sin notificar y esperar confirmación (salvo configuración explícita de auto-regenerar). | M | §4 |
| RF-18 | Todo evento de invalidación queda visible como entrada de actividad en el chat/timeline del proyecto. | M | §4, §6 |

### Confirmación de versiones (checkpoint)

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-25 | Los ajustes, aclaraciones o correcciones sucesivas sobre un documento en discusión se acumulan sobre el mismo borrador de trabajo; el sistema no crea una `DocumentVersion` nueva ni dispara el motor evolutivo por cada comentario individual. | M | §2.2 Estados, §4 Motor evolutivo |
| RF-26 | El sistema pide confirmación explícita antes de consolidar los cambios acumulados en una nueva versión (o la detecta cuando la conversación sobre ese documento se estabiliza y pregunta). Solo en ese momento se evalúa el impacto en el resto del pipeline. | M | §4 |

### Colaboración y visibilidad

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RF-19 | Cualquier documento es consultable en su estado actual (borrador o aprobado) sin esperar a que el pipeline completo termine. | M | §2 Estados |
| RF-20 | El sistema distingue visualmente en el chat un agente "trabajando" de un agente "esperando una respuesta tuya", y agrega una bandeja de preguntas pendientes a nivel de Workspace. | M | §6 Chat en vivo |
| RF-21 | El sistema genera dos salidas: una cotización ejecutiva (PDF, cara al negocio) y un documento técnico con arquitectura completa y anexo de ADRs. | M | §7 Formato de salidas |
| RF-22 | La cotización final expone qué documentos tuvieron revisión humana y cuáles fueron aprobados solo por el agente correspondiente. | M | §5 Roles y aprobación |

## 2.2 Requerimientos no funcionales

| ID | Descripción | Prioridad | Ref. arquitectura |
|---|---|---|---|
| RNF-01 | **Auditabilidad**: toda afirmación legal o de mercado debe ser trazable a una fuente citada y a la versión del documento que la contiene. | M | §3.2, ADR-0001 |
| RNF-02 | **Aislamiento multi-proyecto**: ningún dato o estado de un proyecto es visible o afecta a otro, salvo la bandeja de pendientes agregada a nivel de Workspace. | M | §8 Arquitectura técnica |
| RNF-03 | **Latencia del chat**: los mensajes y eventos de actividad deben reflejarse en la interfaz de todos los participantes conectados en tiempo cercano a real (segundos, no minutos). | M | ADR-0003 |
| RNF-04 | **Portabilidad del proveedor de IA**: ningún agente depende de una API específica de un proveedor; todo pasa por la interfaz común de "LLM Provider". | M | ADR-0004 |
| RNF-05 | **No pérdida de historial**: ninguna versión de un documento se sobrescribe o elimina; toda regeneración crea una versión nueva. | M | §1 Modelo de dominio |
| RNF-06 | **Transparencia de validación humana**: cualquier documento generado sin revisión humana de su rol correspondiente debe quedar marcado como tal, de forma visible en la salida final. | M | §5 Roles y aprobación |
| RNF-07 | **Resiliencia del pipeline**: la ejecución de un agente no debe bloquear la de otros agentes del mismo proyecto sin dependencia directa entre ellos. | M | §3.1 Modelo de `ask_user`, ADR-0002 |
| RNF-08 | **Disponibilidad de preguntas pendientes**: una pregunta bloqueante no puede perderse aunque el usuario esté trabajando en otro proyecto del mismo Workspace. | M | §6 Chat en vivo |
| RNF-09 | **Escalabilidad de ejecución de agentes**: el sistema debe soportar el crecimiento del número de proyectos activos simultáneos sin degradar el tiempo de respuesta del chat, mediante ejecución asíncrona de agentes. | S | ADR-0002 |
| RNF-10 | **Extensibilidad de agentes**: agregar un nuevo tipo de agente/documento al pipeline no debe requerir cambios en los agentes existentes, solo en el grafo de dependencias. | S | §4 Motor evolutivo |
