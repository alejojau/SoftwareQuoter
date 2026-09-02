# ADR-0004: Capa de abstracción de proveedor de IA

**Estado:** Aceptado

## Contexto

Todos los agentes (Elicitador, Legal, Mercado, Analista, Arquitecto,
Generador de Cotización) necesitan invocar un modelo de lenguaje con
soporte de herramientas (`web_search`, `fetch_url`, `save_document`,
`ask_user`, `create_adr`, etc.). El diseño acordado explícitamente no ata
la plataforma a un proveedor de IA único, para evitar vendor lock-in y
poder adaptarse a cambios de precio, capacidad o disponibilidad de
distintos proveedores a lo largo del tiempo.

## Decisión

Definir una interfaz común de **LLM Provider**:

```
complete({ messages, tools }) → { content, tool_calls }
```

Cada agente se implementa contra esta interfaz, no contra el SDK de un
proveedor específico. Los adaptadores concretos (ej. Claude, OpenAI, u
otro) viven en una capa aparte que traduce la interfaz común a las
llamadas específicas de cada API. El MVP implementa un proveedor real
funcional; el resto queda como contrato listo para agregar adaptadores
adicionales sin tocar la lógica de los agentes.

## RNF relacionados

- RNF-04 (portabilidad del proveedor de IA): es la razón de ser de este
  ADR — ningún agente referencia tipos o llamadas específicas de un SDK
  de proveedor.
- RNF-10 (extensibilidad de agentes): un nuevo agente se define contra la
  misma interfaz, sin acoplarse tampoco al proveedor.

## Alternativas consideradas

- **Integración directa con el SDK de un único proveedor:** más simple de
  implementar al inicio, pero descartada porque el usuario definió
  explícitamente el diseño como agnóstico de proveedor, y un acoplamiento
  directo obligaría a reescribir cada agente ante un cambio de proveedor.
- **Framework de orquestación de agentes de terceros ya atado a un
  proveedor:** descartado por la misma razón — resolvería la orquestación
  pero reintroduciría el acoplamiento que se busca evitar.

## Consecuencias

- Se gana libertad para cambiar o combinar proveedores de IA sin reescribir
  agentes, y una superficie de pruebas más simple (se puede simular el
  `LLM Provider` en tests sin llamar a un servicio externo real).
- Se acepta una capa de indirección adicional y el costo de mantener la
  interfaz común alineada a las capacidades reales de cada proveedor que
  se vaya integrando (algunos tienen herramientas o formatos distintos que
  deben normalizarse en el adaptador).
