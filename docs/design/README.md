# SoftwareQuoter — Documento de Diseño

**Versión:** 1.0 · **Estado:** aprobado como base para implementación (fase 3
del proceso de diseño) · **Fecha:** 2026-09-02

## Resumen ejecutivo

SoftwareQuoter es una plataforma que acompaña a un equipo (negocio, análisis,
arquitectura) desde una necesidad de software expresada en lenguaje natural
hasta un **alcance de proyecto, requerimientos validados y una arquitectura
técnica justificada**, apoyándose en agentes de IA especializados que
investigan normativa aplicable, benchmarking de mercado y proponen diseño
técnico — todo de forma **evolutiva**: cuando algo cambia, el sistema
determina qué documentos dependientes deben revalidarse, sin rehacer todo
el trabajo desde cero.

Este documento formaliza lo acordado durante la fase de diseño conversacional
(el registro completo de esa discusión, con las alternativas consideradas en
cada punto, queda en [`borrador-diseno.md`](./borrador-diseno.md) como
referencia histórica).

## Índice

1. [Visión y alcance](./01-vision-alcance.md) — problema, objetivos, alcance
   por fases, qué queda explícitamente fuera.
2. [Requerimientos](./02-requerimientos.md) — funcionales y no funcionales,
   con identificadores para trazabilidad.
3. [Arquitectura y diseño](./03-arquitectura-diseno.md) — modelo de dominio,
   ciclo de vida de documentos, contrato de cada agente, motor evolutivo de
   invalidación, roles, chat en vivo, formato de salidas.
4. [ADRs](./adr/) — decisiones de arquitectura del propio sistema
   (persistencia, cola de trabajos, chat en tiempo real, abstracción del
   proveedor de IA), en el mismo formato que el sistema le exigirá al Agente
   Arquitecto para los proyectos que gestione.

## Implementación

El modelo de datos de la §1 de [Arquitectura y diseño](./03-arquitectura-diseno.md)
ya está implementado como schema real en [`prisma/schema.prisma`](../../prisma/schema.prisma)
(PostgreSQL, ver ADR-0001), con comentarios que referencian los RF/RNF que
cada tabla o campo satisface. Es el primer artefacto de código del proyecto;
el resto de la implementación (API, agentes, chat en vivo) se construye
sobre este modelo.

## Cómo leer esto

Cada requerimiento en el documento 2 tiene un ID (`RF-xx` funcional,
`RNF-xx` no funcional) que se referencia desde el documento 3 cuando una
decisión de diseño existe específicamente para cumplirlo — así queda
trazable por qué existe cada pieza de la arquitectura, no solo qué es.
