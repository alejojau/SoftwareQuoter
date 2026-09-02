# 1. Visión y alcance

## 1.1 Problema

Definir un proyecto de software desde una necesidad de negocio suele hacerse
de forma manual, dispersa y estática: alguien entrevista al cliente, alguien
más investiga (a veces nadie investiga) si hay normativa aplicable o software
similar ya existente, y el alcance/arquitectura/cotización resultante queda
"congelado" — si algo cambia a mitad de camino, revisar el impacto real en
todo lo ya producido es costoso y con frecuencia no se hace, dejando
documentos desactualizados sin que nadie lo note.

## 1.2 Visión

SoftwareQuoter es una plataforma que, a partir de una conversación en chat
en vivo con el equipo del proyecto (negocio, analista, arquitecto — sin
exigir que los tres existan siempre), produce y mantiene **vivos y
versionados**:

- Un Business Brief validado.
- Normativa potencialmente aplicable, con fuente verificable por cualquiera.
- Un benchmarking de software existente similar.
- Requerimientos funcionales y no funcionales trazables.
- Un alcance de proyecto por fases.
- Una arquitectura técnica justificada por los requerimientos no
  funcionales, con sus decisiones documentadas como ADRs.
- Una cotización (PDF ejecutivo) y un documento técnico detallado.

Y lo hace de forma **evolutiva**: un cambio en cualquier punto dispara la
revalidación de todo lo que depende de él, en vez de dejarlo desactualizado
en silencio.

## 1.3 Objetivos del producto

- Reducir el tiempo y la fricción de pasar de "necesidad de negocio" a
  "alcance + arquitectura + cotización" defendibles.
- Que cada afirmación no trivial (una norma aplicable, un competidor
  identificado, una decisión de arquitectura) sea **verificable**, no una
  opinión del modelo sin respaldo.
- Que el sistema **nunca deje pasar en silencio** el impacto de un cambio:
  todo cambio relevante deja rastro de qué se revalidó y qué sigue
  pendiente de revisión humana.
- Soportar avanzar varios proyectos en paralelo, cada uno con su propio
  ritmo, sin que interfieran entre sí.

## 1.4 Usuarios y roles

Tres roles posibles por proyecto — **Negocio**, **Analista de
Requerimientos**, **Arquitecto** — ninguno obligatorio. Un usuario puede
cubrir varios roles; un rol sin humano asignado es cubierto por su agente de
IA correspondiente, y el sistema deja constancia de qué quedó sin revisión
humana (ver [RNF-06](./02-requerimientos.md) y la sección de roles en
[Arquitectura y diseño](./03-arquitectura-diseno.md#5-roles-y-aprobación)).

## 1.5 Alcance por fases

**Fase 1 — MVP** (lo que este documento especifica en detalle):
- Workspace multi-proyecto, con proyectos aislados entre sí.
- Chat en vivo como interfaz principal de elicitación y revisión.
- Pipeline completo de agentes: Elicitador, Legal/Normativo, Mercado,
  Analista de Requerimientos, Alcance/Estimador, Arquitecto, Generador de
  Cotización.
- Motor evolutivo con invalidación **por tipo de documento completo** (no a
  grano fino todavía).
- Abstracción de proveedor de IA en la interfaz, con un proveedor real
  implementado inicialmente.
- Dos salidas: cotización ejecutiva (PDF) y documento técnico con ADRs.

**Fase 2 (futuro, no bloquea el MVP):**
- Invalidación a grano fino por campo (diff semántico entre versiones).
- Múltiples workspaces/organizaciones con control de acceso entre ellos.
- Plantillas de PDF personalizables por marca/cliente más allá del branding
  básico de Workspace.
- Integraciones de exportación (ej. tickets iniciales a Jira/Trello a partir
  del `Scope`).

**Fase 3 (exploratorio):**
- Analítica histórica entre proyectos del mismo Workspace (aprender de
  cotizaciones y estimaciones pasadas para calibrar las nuevas).
- Integración con fuentes legales oficiales estructuradas (APIs de
  boletines/diarios oficiales) en vez de solo búsqueda web genérica.

## 1.6 Fuera de alcance (explícito)

- **No reemplaza asesoría legal profesional.** Los hallazgos legales son
  orientativos y siempre se presentan con ese disclaimer y su fuente.
- **No es una herramienta de gestión de ejecución de proyecto** (no
  reemplaza un tablero tipo Jira una vez el proyecto está cotizado y
  arrancado) — su responsabilidad termina en el alcance/arquitectura/
  cotización.
- **No gestiona facturación ni pagos.**
