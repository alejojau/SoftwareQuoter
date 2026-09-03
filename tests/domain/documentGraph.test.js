const { getDownstreamTypes } = require('../../src/domain/documentGraph');

describe('getDownstreamTypes (RF-16: recorrido transitivo del grafo)', () => {
  test('BUSINESS_BRIEF alcanza todo el grafo aguas abajo', () => {
    const downstream = getDownstreamTypes('BUSINESS_BRIEF').sort();
    expect(downstream).toEqual(
      [
        'LEGAL_FINDINGS',
        'MARKET_FINDINGS',
        'REQUIREMENTS',
        'SCOPE',
        'ARCHITECTURE_DOC',
        'QUOTE',
      ].sort()
    );
  });

  test('QUOTE no tiene nada aguas abajo', () => {
    expect(getDownstreamTypes('QUOTE')).toEqual([]);
  });

  test('SCOPE solo alcanza QUOTE', () => {
    expect(getDownstreamTypes('SCOPE')).toEqual(['QUOTE']);
  });

  test('REQUIREMENTS alcanza SCOPE, ARCHITECTURE_DOC y QUOTE sin duplicados', () => {
    expect(getDownstreamTypes('REQUIREMENTS').sort()).toEqual(
      ['SCOPE', 'ARCHITECTURE_DOC', 'QUOTE'].sort()
    );
  });

  test('un tipo sin salidas definidas no revienta', () => {
    expect(getDownstreamTypes('TIPO_INEXISTENTE')).toEqual([]);
  });
});
