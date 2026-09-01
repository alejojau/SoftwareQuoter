# SoftwareQuoter — Borrador de Diseño (fase de detalle)

> Estado: **borrador vivo**, en discusión. No es el documento de diseño final —
> se irá afinando en conversación y luego se formalizará en la fase 3
> (documento de diseño completo).

## 0. Visión (resumen de la fase de brainstorm)

SoftwareQuoter deja de ser solo una calculadora de costos y pasa a ser una
plataforma de **descubrimiento y definición de proyectos de software asistida
por agentes de IA**. A partir de una necesidad de negocio expresada en chat,
produce de forma iterativa y evolutiva:

- Requerimientos validados (funcionales, no funcionales, restricciones)
- Normativa aplicable, con fuentes verificables
- Benchmarking de software existente similar
- Alcance de proyecto + arquitectura/diseño técnico (con ADRs justificados)
- Cotización final (PDF) + documento técnico

Decisiones ya tomadas:
- Colaboración de hasta 3 roles por proyecto (Negocio, Analista, Arquitecto),
  pero ninguno es obligatorio — un agente cubre el rol si no hay humano.
- Elicitación y revisión ocurren en **chat en tiempo real**.
- Legal es **configurable por proyecto** (país/industria), no fijo.
- Diseño de IA **agnóstico de proveedor** (interfaz común, no atado a un LLM).
- Salida dual: PDF ejecutivo + documento técnico con arquitectura justificada
  por RNF (concurrencia, disponibilidad, carga) y **ADRs**.
- **Multi-proyecto**: se puede avanzar varios a la vez y retomar cada uno.
- Resultados **parciales visibles** durante todo el proceso, no solo al final.
- Cada hallazgo legal (y de mercado) debe traer **fuente verificable**
  (primaria obligatoria, secundaria opcional), fecha de consulta y nivel de
  confianza.

---

## 1. Modelo de dominio

```
Workspace
 └─ Project (estado_general, created_at, paused_at)
     ├─ ProjectMember (user_id, roles[]: NEGOCIO | ANALISTA | ARQUITECTO)
     ├─ ChatSession
     │   └─ Message (autor, contenido, tipo, timestamp, refs a DocumentNode)
     ├─ DocumentNode (tipo, estado, current_version_id)
     │   └─ DocumentVersion (numero, contenido, generado_por,
     │                       inputs_usados[] -> otras DocumentVersion,
     │                       aprobado_por, aprobado_at)
     ├─ ChangeEvent (origen, documento_afectado_inicial, timestamp)
     └─ InvalidationRun (change_event_id, nodos_invalidados[],
                          nodos_regenerados[], estado)
```

Tipos de `DocumentNode` (uno por proyecto, cada uno versionado):

`BusinessBrief`, `LegalFindings`, `MarketFindings`, `Requirements`, `Scope`,
`ArchitectureDoc` (contiene N `ADR`), `Quote`.

**Sub-estructuras de contenido** (dentro de una `DocumentVersion`):

- `LegalFinding`: `{norma, resumen_aplicabilidad, fuente_primaria_url,
  fuentes_secundarias[], fecha_consulta, confianza, disclaimer}`
- `MarketFinding`: `{producto, descripcion, url, features[], precio_aprox,
  fecha_consulta}`
- `ADR`: `{titulo, estado, contexto, decision, rnf_relacionados[],
  alternativas_consideradas[], consecuencias}`

La relación `inputs_usados[]` de cada `DocumentVersion` **es** el grafo de
dependencias — no hace falta una tabla de aristas aparte; se reconstruye
consultando qué versiones consumió cada versión.

---

## 2. Estados

### 2.1 Estado de `Project` (derivado, informativo)

```
nuevo → elicitacion_en_curso → investigacion_en_curso →
requerimientos_en_consolidacion → requerimientos_listos →
diseño_en_curso → cotizacion_generada
```

En paralelo, en cualquier punto: `en_revision` (hay documentos con cambios
pendientes de aprobar) y `pausado` (el usuario lo dejó y retomó otro).

### 2.2 Estado de `DocumentNode` (el que importa para el motor evolutivo)

```
pendiente → generando → borrador → en_revision_humana → aprobado
                                        ↑                    │
                                        └─── ajuste pedido ───┘

aprobado → obsoleto (por invalidación) → regenerando → borrador (nueva versión)
```

Un documento `obsoleto` **no se borra**: la versión anterior sigue visible y
consultable mientras se regenera la nueva (soporta el requisito de "ver
resultados parciales" y trazabilidad histórica).

---

## 3. Contrato de cada agente

| Agente | Dispara cuando | Input | Tools | Output | Regla especial |
|---|---|---|---|---|---|
| **Elicitador** | Se crea el proyecto, o el usuario reabre el Brief | Historial de chat + Brief actual | `save_document(BusinessBrief)`, `ask_user` | `BusinessBrief` | No pasa a `borrador` hasta cubrir checklist mínima: objetivo, usuarios finales, dominio/industria, país/región, restricciones conocidas |
| **Legal/Normativo** | `BusinessBrief` aprobado o cambia | `BusinessBrief` (industria, país) | `web_search`, `fetch_url`, `save_document(LegalFindings)` | `LegalFindings[]` | Nunca reporta una norma sin fuente primaria; si no hay fuente confirmable, la marca como "sin confirmar" |
| **Mercado** | Igual que Legal, en paralelo | `BusinessBrief` (problema, industria) | `web_search`, `fetch_url`, `save_document(MarketFindings)` | `MarketFindings[]` | Cada hallazgo con fuente/URL |
| **Analista de Requerimientos** | Brief + Legal + Mercado en al menos `borrador` | Los tres anteriores + peticiones directas del usuario final (chat) | `save_document(Requirements)`, `ask_user` | `Requirements` (historias de usuario, FR/NFR, restricciones ligadas a hallazgos legales concretos) | Cada restricción regulatoria debe citar el `LegalFinding` que la origina |
| **Alcance/Estimador** | `Requirements` aprobado o cambia | `Requirements` | `save_document(Scope)` | `Scope` (fases, MVP vs. completo, dependencias) | — |
| **Arquitecto** | Junto con o después de Alcance | `Requirements` (RNF) + `Scope` | `save_document(ArchitectureDoc)`, `create_adr` | `ArchitectureDoc` + `ADR[]` | Toda decisión "grande" (stack, patrón arquitectónico, colas, balanceo, orquestación de contenedores, BD) requiere un ADR con los RNF que la motivaron |
| **Generador de Cotización** | `Scope` + `ArchitectureDoc` aprobados | Ambos + parámetros de costeo | `render_pdf` | `Quote` (PDF + doc técnico consolidado) | — |
| **Orquestador / Gestor de Cambios** | Cualquier `ChangeEvent` | Grafo de dependencias | — | `InvalidationRun` | Ver algoritmo abajo |

---

## 4. Motor evolutivo — algoritmo de invalidación

Grafo fijo por tipo de documento (MVP; ver optimización futura):

```
BusinessBrief ─┬─→ LegalFindings ─┐
               └─→ MarketFindings ┴─→ Requirements ─┬─→ Scope ─┐
                                                     └─→ Architecture ┴─→ Quote
```

Cuando ocurre un `ChangeEvent` sobre un nodo `X` (edición humana, o una nueva
versión de un agente):

1. Se crea la nueva `DocumentVersion` de `X` (queda historial).
2. Se recorre el grafo hacia adelante desde `X`: todo nodo `Y` alcanzable se
   marca `obsoleto` (la versión previa de `Y` sigue visible).
3. Por cada nodo `obsoleto` se encola su regeneración, **pero no se ejecuta
   automáticamente si ese nodo ya estaba `aprobado` por un humano** — se
   notifica en el chat y se espera confirmación (salvo que el proyecto tenga
   activado "auto-regenerar borradores").
4. Al regenerar, el agente puede concluir que el cambio no afecta su
   resultado real (ej. cambia el nombre del proyecto, no afecta lo legal) —
   en ese caso marca la nueva versión como "sin cambios sustanciales" y se
   auto-aprueba, para no generar fatiga de revisión.
5. Se registra un `InvalidationRun` visible como evento en el chat/timeline:
   _"Cambiaste el país en el Brief → esto invalidó Hallazgos Legales y, en
   cascada, Requerimientos, Alcance y Arquitectura. Hallazgos Legales se
   regeneró automáticamente; los demás están pendientes de tu revisión."_

**Optimización futura (no MVP):** invalidación a grano fino por campo (ej.
solo si cambia el campo país, no si cambia el nombre del proyecto), vía diff
semántico entre versiones. El MVP prefiere sobre-invalidar (falso positivo
aceptable) a sub-invalidar (falso negativo, peligroso: dejar un documento
desactualizado sin avisar).

---

## 5. Roles y aprobación

| Documento | Quién aprueba | Si el rol no tiene humano asignado |
|---|---|---|
| `BusinessBrief`, `Quote` | Negocio | El propio Negocio (usuario) siempre debe existir; no delegable a agente |
| `Requirements` | Analista | Agente Analista se auto-aprueba y el documento queda marcado "sin revisión humana de Analista" |
| `Scope` | Analista + Negocio | Igual, marcado si falta alguno |
| `ArchitectureDoc` / `ADR` | Arquitecto | Agente Arquitecto se auto-aprueba, marcado "sin revisión humana de Arquitecto" |

El `Quote` final (PDF) incluye una sección de **trazabilidad de aprobación**
que expone qué documentos tuvieron revisión humana y cuáles no, para que el
receptor de la cotización sepa el nivel de validación real.

---

## 6. Chat en vivo — eventos

- Mensaje de usuario puede: responder una pregunta de un agente, marcarse
  explícitamente como cambio (acción "esto cambia el alcance/brief" →
  genera `ChangeEvent`, no solo texto libre), o mencionar a un rol/agente.
- Eventos de sistema embebidos en el mismo chat: _"Agente Legal generó
  Hallazgos Legales v2 (fuente: ...)"_, _"Requerimientos quedó obsoleto por
  cambio en Brief"_, etc. — timeline de actividad integrado, no aparte.
- Multi-usuario: presence (quién está conectado/escribiendo) y bloqueo
  ligero para evitar aprobaciones simultáneas conflictivas sobre la misma
  versión.

---

## 7. Arquitectura técnica del propio sistema (alto nivel)

- **Backend:** Node/Express (ya existe base en el repo) + capa de
  orquestación de agentes + WebSocket (ej. socket.io) para el chat en vivo.
- **Abstracción de proveedor de IA:** interfaz común
  `complete({messages, tools}) → {content, tool_calls}`, implementable para
  Claude, OpenAI u otro sin tocar la lógica de los agentes.
- **Persistencia:** relacional (Postgres) para entidades estructuradas
  (`Project`, `DocumentNode`, metadatos de `DocumentVersion`, roles);
  contenido de cada versión como JSON/markdown en columna.
- **Cola de trabajos** (ej. Redis + BullMQ) para ejecutar agentes de forma
  asíncrona — el propio sistema aplicaría el mismo patrón que recomendaría
  a otros proyectos con RNF de concurrencia.
- **PDF:** generación por plantilla a partir de `Quote` + `ArchitectureDoc`.
- **Multi-proyecto:** todo aislado por `project_id`; nada de estado global
  compartido entre proyectos salvo el `Workspace`/usuario.

---

## 8. Abierto para siguiente ronda

- Modelo exacto de `ask_user` (¿bloquea al agente hasta respuesta, o el
  agente sigue con otras tareas mientras espera?).
- Formato exacto del `Quote` en PDF (secciones, plantilla visual).
- Política de conflicto cuando dos fuentes legales se contradicen.
- Priorización de jurisdicción nacional vs. local/municipal.
