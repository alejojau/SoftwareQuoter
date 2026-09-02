# 3. Arquitectura y diseño

## 1. Modelo de dominio

```
Workspace
 └─ Project (estado_general, created_at, paused_at)                      [RF-01]
     ├─ ProjectMember (user_id, roles[]: NEGOCIO | ANALISTA | ARQUITECTO) [RF-02]
     ├─ ChatSession
     │   └─ Message (autor, contenido, tipo, timestamp, refs a DocumentNode)
     ├─ DocumentNode (tipo, estado, current_version_id)
     │   └─ DocumentVersion (numero, contenido, generado_por,
     │                       inputs_usados[] -> otras DocumentVersion,
     │                       aprobado_por, aprobado_at)                  [RNF-05]
     ├─ ChangeEvent (origen, documento_afectado_inicial, timestamp)
     └─ InvalidationRun (change_event_id, nodos_invalidados[],
                          nodos_regenerados[], estado)
```

Tipos de `DocumentNode` (uno por proyecto, cada uno versionado): `BusinessBrief`,
`LegalFindings`, `MarketFindings`, `Requirements`, `Scope`, `ArchitectureDoc`
(contiene N `ADR`), `Quote`.

**Sub-estructuras de contenido** (dentro de una `DocumentVersion`):

- `LegalFinding`: `{norma, resumen_aplicabilidad, fuente_primaria_url,
  fuentes_secundarias[], fecha_consulta, confianza, conflicto,
  fuentes_en_conflicto[], disclaimer}` — cumple RF-06, RF-07.
- `MarketFinding`: `{producto, descripcion, url, features[], precio_aprox,
  fecha_consulta}` — cumple RF-09.
- `ADR`: `{titulo, estado, contexto, decision, rnf_relacionados[],
  alternativas_consideradas[], consecuencias}` — cumple RF-14.

La relación `inputs_usados[]` de cada `DocumentVersion` **es** el grafo de
dependencias — no hace falta una tabla de aristas aparte; se reconstruye
consultando qué versiones consumió cada versión. Aislar todo por
`project_id` en cada entidad cumple RNF-02.

---

## 2. Estados

### 2.1 Estado de `Project` (derivado, informativo)

```
nuevo → elicitacion_en_curso → investigacion_en_curso →
requerimientos_en_consolidacion → requerimientos_listos →
diseño_en_curso → cotizacion_generada
```

En paralelo, en cualquier punto: `en_revision` (hay documentos con cambios
pendientes de aprobar) y `pausado` (el usuario lo dejó y retomó otro,
cumpliendo RF-01).

### 2.2 Estado de `DocumentNode` (el que importa para el motor evolutivo)

```
pendiente → generando → borrador → en_revision_humana → aprobado
               │  ↑                     ↑                    │
               │  └── esperando_respuesta (ask_user bloqueante)
               │                         └─── ajuste pedido ───┘

aprobado → obsoleto (por invalidación) → regenerando → borrador (nueva versión)
```

Un documento `obsoleto` **no se borra**: la versión anterior sigue visible y
consultable mientras se regenera la nueva — cumple RF-19 y RNF-05.
`esperando_respuesta` es un sub-estado de `generando`: bloquea únicamente
**ese** `DocumentNode`, no el proyecto (RNF-07).

---

## 3. Contrato de cada agente

| Agente | Dispara cuando | Input | Tools | Output | Regla especial |
|---|---|---|---|---|---|
| **Elicitador** | Se crea el proyecto, o el usuario reabre el Brief | Historial de chat + Brief actual | `save_document(BusinessBrief)`, `ask_user` | `BusinessBrief` | No pasa a `borrador` hasta cubrir checklist mínima (RF-03, RF-04) |
| **Legal/Normativo** | `BusinessBrief` aprobado o cambia | `BusinessBrief` (industria, país) | `web_search`, `fetch_url`, `save_document(LegalFindings)` | `LegalFindings[]` | Nunca reporta una norma sin fuente primaria (RF-06); ver reglas §3.2 |
| **Mercado** | Igual que Legal, en paralelo | `BusinessBrief` (problema, industria) | `web_search`, `fetch_url`, `save_document(MarketFindings)` | `MarketFindings[]` | Cada hallazgo con fuente/URL (RF-09) |
| **Analista de Requerimientos** | Brief + Legal + Mercado en al menos `borrador` | Los tres anteriores + peticiones directas del usuario final (chat) | `save_document(Requirements)`, `ask_user` | `Requirements` | Cada restricción regulatoria cita el `LegalFinding` que la origina (RF-11) |
| **Alcance/Estimador** | `Requirements` aprobado o cambia | `Requirements` | `save_document(Scope)` | `Scope` (RF-12) | — |
| **Arquitecto** | Junto con o después de Alcance | `Requirements` (RNF) + `Scope` | `save_document(ArchitectureDoc)`, `create_adr` | `ArchitectureDoc` + `ADR[]` | Toda decisión grande requiere ADR con RNF asociados (RF-13, RF-14) |
| **Generador de Cotización** | `Scope` + `ArchitectureDoc` aprobados | Ambos + parámetros de costeo | `render_pdf` | `Quote` (RF-15, RF-21) | — |
| **Orquestador / Gestor de Cambios** | Cualquier `ChangeEvent` | Grafo de dependencias | — | `InvalidationRun` | Ver §4 |

### 3.1 Modelo de `ask_user`

No todas las preguntas de un agente se tratan igual:

- **Bloqueante (crítica):** el agente no puede producir nada razonable sin
  la respuesta. El `DocumentNode` entra en el sub-estado
  `esperando_respuesta`, bloqueando solo ese documento — otros agentes del
  mismo proyecto sin esa dependencia siguen corriendo (RNF-07).
- **No bloqueante (aclaratoria):** el agente sigue y produce un borrador
  razonable, marcando la parte afectada como `supuesto: no_confirmado`.
  Cuando el usuario responde después, se genera un `ChangeEvent` normal,
  procesado por el algoritmo de §4 — no es un caso especial.
- **Timeout:** la elicitación inicial del Brief (país, industria, objetivo)
  no expira automáticamente — sin eso no hay proyecto real que investigar.
  El resto de preguntas bloqueantes tiene timeout configurable por proyecto
  (default 24h); al vencer, el agente avanza con un supuesto documentado en
  vez de trabar el resto del grafo. Cada `ask_user` lleva un flag de
  criticidad (`dura`/`blanda`) que decide si aplica timeout.

### 3.2 Reglas adicionales del agente Legal/Normativo

- **Conflicto entre fuentes (RF-07):** si dos fuentes primarias (o una
  primaria y una secundaria) se contradicen, el agente no decide por su
  cuenta. El `LegalFinding` se marca `conflicto: true`, cita ambas fuentes,
  baja su `confianza` a `baja`, y recomienda validación con asesor legal en
  ese punto puntual. Solo resuelve automáticamente el caso trivial y no
  ambiguo de jerarquía normativa clara (norma posterior deroga a una
  anterior de igual jerarquía), dejando anotado el criterio aplicado.
- **Jurisdicción nacional vs. local/municipal (RF-08):** no se reemplazan
  entre sí. La normativa nacional aplica siempre como base; la
  local/municipal se añade cuando es más específica o restrictiva. El
  agente solo evalúa nivel local si el `BusinessBrief` tiene precisión
  suficiente (ciudad/región); si no la tiene y el dominio típicamente
  depende de eso, lo marca como pendiente y pregunta en vez de asumir. Un
  conflicto directo no trivial entre niveles sigue la misma regla anterior.

---

## 4. Motor evolutivo — algoritmo de invalidación

Grafo fijo por tipo de documento (fase 1; ver optimización de fase 2):

```
BusinessBrief ─┬─→ LegalFindings ─┐
               └─→ MarketFindings ┴─→ Requirements ─┬─→ Scope ─┐
                                                     └─→ Architecture ┴─→ Quote
```

Cuando ocurre un `ChangeEvent` sobre un nodo `X` (edición humana, o una
nueva versión de un agente):

1. Se crea la nueva `DocumentVersion` de `X` (RNF-05: queda historial).
2. Se recorre el grafo hacia adelante desde `X`: todo nodo `Y` alcanzable se
   marca `obsoleto` (RF-16; la versión previa de `Y` sigue visible).
3. Por cada nodo `obsoleto` se encola su regeneración, **pero no se ejecuta
   automáticamente si ese nodo ya estaba `aprobado` por un humano** (RF-17)
   — se notifica en el chat y se espera confirmación (salvo configuración
   de auto-regenerar).
4. Al regenerar, el agente puede concluir que el cambio no afecta su
   resultado real — en ese caso marca la nueva versión como "sin cambios
   sustanciales" y se auto-aprueba, para no generar fatiga de revisión.
5. Se registra un `InvalidationRun` visible como evento en el chat/timeline
   (RF-18): _"Cambiaste el país en el Brief → esto invalidó Hallazgos
   Legales y, en cascada, Requerimientos, Alcance y Arquitectura. Hallazgos
   Legales se regeneró automáticamente; los demás están pendientes de tu
   revisión."_

**Fase 2:** invalidación a grano fino por campo (ej. solo si cambia el
campo país, no si cambia el nombre del proyecto), vía diff semántico entre
versiones. La fase 1 prefiere sobre-invalidar (falso positivo aceptable) a
sub-invalidar (falso negativo, peligroso: dejar un documento desactualizado
sin avisar) — es la lectura conservadora de RF-16.

---

## 5. Roles y aprobación

| Documento | Quién aprueba | Si el rol no tiene humano asignado |
|---|---|---|
| `BusinessBrief`, `Quote` | Negocio | El propio Negocio (usuario) siempre debe existir; no delegable a agente |
| `Requirements` | Analista | Agente Analista se auto-aprueba y el documento queda marcado "sin revisión humana de Analista" |
| `Scope` | Analista + Negocio | Igual, marcado si falta alguno |
| `ArchitectureDoc` / `ADR` | Arquitecto | Agente Arquitecto se auto-aprueba, marcado "sin revisión humana de Arquitecto" |

El `Quote` final incluye una sección de **trazabilidad de aprobación** que
expone qué documentos tuvieron revisión humana y cuáles no (RF-22, RNF-06).

---

## 6. Chat en vivo — eventos

- Mensaje de usuario puede: responder una pregunta de un agente, marcarse
  explícitamente como cambio (acción "esto cambia el alcance/brief" →
  genera `ChangeEvent`, no solo texto libre), o mencionar a un rol/agente.
- Eventos de sistema embebidos en el mismo chat: _"Agente Legal generó
  Hallazgos Legales v2 (fuente: ...)"_, _"Requerimientos quedó obsoleto por
  cambio en Brief"_, etc. — timeline de actividad integrado, no aparte.
- **Distinción visual `generando` vs. `esperando_respuesta`** (RF-20): un
  documento `generando` se muestra como indicador tipo "escribiendo…" que
  no reclama atención. Uno en `esperando_respuesta` se ancla como tarjeta
  de pregunta explícita, dirigida a un rol concreto, con estado visible.
- **Bandeja de pendientes a nivel de Workspace** (RF-20, RNF-08): agrega las
  preguntas bloqueantes de todos los proyectos activos, para que una
  pregunta en un proyecto que el usuario no está mirando no se pierda.
- Multi-usuario: presence (quién está conectado/escribiendo) y bloqueo
  ligero para evitar aprobaciones simultáneas conflictivas sobre la misma
  versión.

---

## 7. Formato de las salidas (Quote y documento técnico)

Dos documentos (RF-21) a partir del mismo `Quote`/`ArchitectureDoc`
versionados — dos plantillas de render, no dos fuentes de verdad distintas:

**Cotización ejecutiva (PDF, cara al negocio):**
1. Portada (proyecto, fecha, versión, cliente)
2. Resumen ejecutivo (necesidad de negocio + alcance en un párrafo)
3. Alcance por fases (MVP vs. completo, entregables por fase)
4. Requerimientos clave (resumen de historias de usuario y NFR principales)
5. Consideraciones normativas (resumen + disclaimer + fuentes principales)
6. Estimación de costos y tiempos (desglose por fase/rol)
7. Supuestos y riesgos, incluida la trazabilidad de aprobación (RF-22)

**Documento técnico (para el equipo que construye):**
Todo lo anterior en detalle, más: arquitectura propuesta completa (diagrama
de componentes, stack), anexo con todos los ADRs, anexo con hallazgos
legales y de mercado completos con fuentes.

### 7.1 Plantilla y renderizado

- **Contenido y renderizado van separados.** El Agente Arquitecto no dibuja
  el PDF: produce una descripción estructurada de componentes, conexiones y
  RNF asociados. Una capa de renderizado aparte la convierte en diagrama
  usando notación estándar (tipo Mermaid/C4) — consistente entre versiones
  y regenerable automáticamente cuando cambia la arquitectura.
- **Branding** (logo, nombre) configurable a nivel `Workspace`, con opción
  de override por proyecto; paleta y tipografía neutras por defecto.
- Ambos documentos comparten la misma plantilla base.

---

## 8. Arquitectura técnica del propio sistema

- **Backend:** Node/Express (base ya existente en el repo) + capa de
  orquestación de agentes + WebSocket (ver ADR-0003) para el chat en vivo.
- **Abstracción de proveedor de IA:** interfaz común
  `complete({messages, tools}) → {content, tool_calls}` (ver ADR-0004),
  cumpliendo RNF-04.
- **Persistencia:** relacional (ver ADR-0001) para entidades estructuradas;
  contenido de cada versión como JSON/markdown en columna.
- **Cola de trabajos** (ver ADR-0002) para ejecutar agentes de forma
  asíncrona, cumpliendo RNF-07 y RNF-09 — el propio sistema aplica el mismo
  patrón que recomendaría a otros proyectos con RNF de concurrencia.
- **PDF:** generación por plantilla a partir de `Quote` + `ArchitectureDoc`.
- **Multi-proyecto:** todo aislado por `project_id` (RNF-02); nada de
  estado global compartido entre proyectos salvo el `Workspace`/usuario.

Ver [ADRs](./adr/) para el detalle y las alternativas descartadas en cada
una de estas decisiones.
