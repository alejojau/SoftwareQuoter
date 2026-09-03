/**
 * Grafo fijo de dependencias entre tipos de documento — fase 1 del motor
 * evolutivo (docs/design/03-arquitectura-diseno.md §4). La invalidación a
 * grano fino por campo es optimización de fase 2, ver docs/design/01-vision-alcance.md.
 */
const DOCUMENT_GRAPH = Object.freeze({
  BUSINESS_BRIEF: ['LEGAL_FINDINGS', 'MARKET_FINDINGS'],
  LEGAL_FINDINGS: ['REQUIREMENTS'],
  MARKET_FINDINGS: ['REQUIREMENTS'],
  REQUIREMENTS: ['SCOPE', 'ARCHITECTURE_DOC'],
  SCOPE: ['QUOTE'],
  ARCHITECTURE_DOC: ['QUOTE'],
  QUOTE: [],
});

/**
 * RF-16: todo nodo alcanzable aguas abajo de `type`, no solo sus hijos
 * directos — recorrido transitivo completo del grafo (BFS).
 */
function getDownstreamTypes(type) {
  const visited = new Set();
  const queue = [...(DOCUMENT_GRAPH[type] || [])];

  while (queue.length > 0) {
    const next = queue.shift();
    if (visited.has(next)) continue;
    visited.add(next);
    queue.push(...(DOCUMENT_GRAPH[next] || []));
  }

  return [...visited];
}

module.exports = { DOCUMENT_GRAPH, getDownstreamTypes };
