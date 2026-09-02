# ADR-0001: Persistencia relacional (PostgreSQL) para el modelo de dominio

**Estado:** Aceptado

## Contexto

El modelo de dominio (`Workspace → Project → DocumentNode → DocumentVersion`,
con `inputs_usados[]` formando el grafo de dependencias) requiere:
- Integridad referencial fuerte entre `DocumentVersion` y las versiones que
  usó como input, porque el algoritmo de invalidación (RF-16, RF-17) depende
  de recorrer ese grafo de forma consistente.
- Transacciones: al invalidar un `ChangeEvent`, varios `DocumentNode` deben
  actualizar su estado de forma atómica (RNF-05: nunca perder historial a
  mitad de una invalidación parcial).
- Consultas relacionales frecuentes (todos los documentos de un proyecto,
  todas las versiones no aprobadas de un `DocumentNode`, etc.).

## Decisión

Usar **PostgreSQL** como almacén principal para las entidades estructuradas
(`Project`, `ProjectMember`, `DocumentNode`, metadatos de `DocumentVersion`,
`ChangeEvent`, `InvalidationRun`). El contenido extenso de cada versión
(texto del Brief, listado de `LegalFinding`, etc.) se guarda como columna
`JSONB`, combinando la integridad relacional del grafo con la flexibilidad
de esquema para el contenido generado por los agentes.

## RNF relacionados

- RNF-02 (aislamiento multi-proyecto) — se implementa con `project_id` como
  clave foránea obligatoria en cada tabla relevante.
- RNF-05 (no pérdida de historial) — se apoya en transacciones y en que
  `DocumentVersion` es un log append-only, nunca actualizado in-place.

## Alternativas consideradas

- **Base de datos documental pura (ej. MongoDB):** descartada porque el
  grafo de dependencias y las invalidaciones en cascada se benefician
  directamente de integridad referencial y transacciones multi-documento,
  que un almacén documental ofrece con más fricción.
- **Event sourcing puro (solo log de eventos, sin tablas de estado):**
  descartado para el MVP por complejidad operativa; se puede revisar en
  fase 2 si el volumen de versiones lo justifica.

## Consecuencias

- Se gana consistencia fuerte para el algoritmo de invalidación y
  consultas relacionales simples de escribir.
- Se acepta el costo operativo de administrar una base relacional
  (migraciones de esquema para las columnas estructuradas, aunque el
  contenido en `JSONB` amortigua parte de ese costo).
