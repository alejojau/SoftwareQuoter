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
               │  ↑                     ↑                    │
               │  └── esperando_respuesta (ask_user bloqueante)
               │                         └─── ajuste pedido ───┘

aprobado → obsoleto (por invalidación) → regenerando → borrador (nueva versión)
```

Un documento `obsoleto` **no se borra**: la versión anterior sigue visible y
consultable mientras se regenera la nueva (soporta el requisito de "ver
resultados parciales" y trazabilidad histórica).

`esperando_respuesta` es un sub-estado de `generando`: bloquea únicamente
**ese** `DocumentNode`, no el proyecto — otros agentes sin esa dependencia
siguen corriendo en paralelo (ver 3.1).

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

### 3.1 Modelo de `ask_user`

No todas las preguntas de un agente se tratan igual:

- **Bloqueante (crítica):** el agente no puede producir nada razonable sin
  la respuesta (ej. el Elicitador sin país/industria). El `DocumentNode`
  entra en el sub-estado `esperando_respuesta`. Esto bloquea solo ese
  documento — otros agentes del mismo proyecto sin esa dependencia siguen
  corriendo, porque cada uno es un job independiente.
- **No bloqueante (aclaratoria):** el agente sigue y produce un borrador
  razonable, marcando la parte afectada como `supuesto: no_confirmado`.
  Cuando el usuario responde después, se genera un `ChangeEvent` normal,
  procesado por el mismo algoritmo de invalidación de la sección 4 — no es
  un caso especial.
- Una pregunta bloqueante no espera indefinidamente, **salvo una excepción**:
  la elicitación inicial del `BusinessBrief` (país, industria, objetivo) no
  tiene timeout, porque sin eso no hay proyecto real que investigar y no hay
  nada aguas abajo bloqueado innecesariamente — el proyecto simplemente
  queda en `elicitacion_en_curso`. Para el resto de preguntas bloqueantes
  (ya con el pipeline en marcha), el timeout es **configurable por
  proyecto**, con default de 24 horas; al vencer, el agente avanza con un
  supuesto documentado en vez de trabar el resto del grafo. Cada llamada a
  `ask_user` lleva un flag de criticidad (`dura`/`blanda`) que decide si
  aplica timeout.

### 3.2 Reglas adicionales del agente Legal/Normativo

- **Conflicto entre fuentes:** si dos fuentes primarias (o una primaria y
  una secundaria) se contradicen sobre la misma norma, el agente **no
  decide por su cuenta**. El `LegalFinding` se marca `conflicto: true`, cita
  ambas fuentes, baja su `confianza` a `baja`, y recomienda validación con
  asesor legal en ese punto puntual. Solo resuelve automáticamente el caso
  trivial y no ambiguo de jerarquía normativa clara (norma posterior deroga
  a una anterior de igual jerarquía), y aun así deja anotado el criterio
  aplicado — nunca lo oculta.
- **Jurisdicción nacional vs. local/municipal:** no se reemplazan entre sí.
  La normativa nacional aplica siempre como base; la local/municipal se
  **añade** cuando es más específica o restrictiva (permisos, tasas
  locales, etc.). El agente solo evalúa nivel local si el `BusinessBrief`
  tiene precisión suficiente (ciudad/región); si no la tiene y el dominio
  del negocio típicamente depende de eso (ej. licencias), lo marca como
  pendiente y pregunta en vez de asumir. Un conflicto directo entre niveles
  que no sea trivial sigue la misma regla de conflicto de arriba.

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
- **Distinción visual `generando` vs. `esperando_respuesta`:** un documento
  `generando` se muestra como un indicador tipo "escribiendo…" que no
  reclama atención — el usuario puede seguir con otra cosa mientras tanto.
  Un documento en `esperando_respuesta` se ancla como una **tarjeta de
  pregunta explícita** en el chat (no un mensaje más que se pierde en el
  scroll), dirigida a un rol concreto, con estado "pendiente" visible.
- Como el sistema es multi-proyecto, además se necesita una **bandeja de
  pendientes a nivel de Workspace** (ej. "3 preguntas esperando tu
  respuesta" agregadas entre todos los proyectos activos) — si no, una
  pregunta bloqueante en un proyecto que el usuario no está mirando en ese
  momento se pierde y nunca se resuelve a tiempo.
- Multi-usuario: presence (quién está conectado/escribiendo) y bloqueo
  ligero para evitar aprobaciones simultáneas conflictivas sobre la misma
  versión.

---

## 7. Formato de las salidas (Quote y documento técnico)

Se generan **dos documentos** a partir del mismo `Quote`/`ArchitectureDoc`
versionados (dos plantillas de render, no dos fuentes de verdad distintas),
porque tienen públicos distintos:

**Cotización ejecutiva (PDF, cara al negocio):**
1. Portada (proyecto, fecha, versión, cliente)
2. Resumen ejecutivo (necesidad de negocio + alcance en un párrafo)
3. Alcance por fases (MVP vs. completo, entregables por fase)
4. Requerimientos clave (resumen de historias de usuario y NFR principales)
5. Consideraciones normativas (resumen + disclaimer + fuentes principales)
6. Estimación de costos y tiempos (desglose por fase/rol)
7. Supuestos y riesgos, incluida la trazabilidad de qué quedó "sin revisión
   humana" (sección 5)

**Documento técnico (para el equipo que construye):**
Todo lo anterior en detalle, más:
8. Arquitectura propuesta completa (diagrama de componentes, stack)
9. Anexo: todos los ADRs
10. Anexo: hallazgos legales y de mercado completos, con fuentes

### 7.1 Plantilla y renderizado

- **Contenido y renderizado van separados.** El Agente Arquitecto no dibuja
  el PDF: produce una descripción estructurada de componentes, conexiones y
  los RNF asociados a cada uno. Una capa de renderizado aparte convierte esa
  descripción en diagrama, usando una notación estándar (tipo Mermaid/C4) en
  vez de dejar que el LLM "dibuje" libremente — así el diagrama es
  consistente entre versiones y se puede regenerar automáticamente cuando
  cambia la arquitectura, sin pedirle al agente que reinvente el layout.
- **Branding** (logo, nombre) configurable a nivel `Workspace`, con opción
  de override por proyecto; paleta y tipografía neutras por defecto.
- Ambos documentos (ejecutivo y técnico) comparten la misma plantilla base;
  el técnico solo añade secciones y anexos.

---

## 8. Arquitectura técnica del propio sistema (alto nivel)

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

## 9. Decidido hasta ahora

- Modelo de `ask_user`: bloqueante vs. aclaratoria, bloqueo por documento no
  por proyecto, sin timeout solo en la elicitación inicial del Brief, 24h
  configurable por proyecto para el resto (sección 3.1).
- Formato de salida: dos documentos (cotización ejecutiva + documento
  técnico) sobre la misma fuente de verdad, con contenido y renderizado
  separados (diagramas por notación estándar, no dibujados por el LLM) y
  branding a nivel `Workspace` (secciones 7 y 7.1).
- Conflicto entre fuentes legales: nunca se resuelve solo si hay ambigüedad
  real; se marca y se escala a revisión humana (sección 3.2).
- Jurisdicción nacional vs. local: se acumulan, no se reemplazan; local solo
  se evalúa con precisión de ubicación suficiente (sección 3.2).
- Representación en chat: `generando` no reclama atención, `esperando_
  respuesta` se ancla como tarjeta explícita + bandeja de pendientes a
  nivel de Workspace, dado que el sistema es multi-proyecto (sección 6).

## 10. Abierto para siguiente ronda

- Ninguno crítico por ahora — los puntos de la fase de detalle quedaron
  resueltos. Lo siguiente natural es empezar a formalizar todo esto en el
  documento de diseño completo (fase 3), o prototipar el modelo de datos.
