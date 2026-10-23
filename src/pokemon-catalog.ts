import data from './catalog/pokemon.json';

export type PokemonCharacter = `pokemon-${number}`;
export const POKEMON_CATALOG = data;
export const pokemonCharacter = (dex: number): PokemonCharacter => `pokemon-${dex}`;
export const POKEMON_TYPES: Record<string, { zh: string; en: string; color: string }> = {
  normal: {zh:'一般',en:'Normal',color:'#f2eee7'}, grass:{zh:'草',en:'Grass',color:'#e8f3e9'},
  fire:{zh:'火',en:'Fire',color:'#fcebdc'}, water:{zh:'水',en:'Water',color:'#e8f3f7'},
  electric:{zh:'电',en:'Electric',color:'#fcf4d9'}, bug:{zh:'虫',en:'Bug',color:'#edf2dd'},
  flying:{zh:'飞行',en:'Flying',color:'#edf0fc'}, poison:{zh:'毒',en:'Poison',color:'#f1e9f6'},
  ground:{zh:'地面',en:'Ground',color:'#f4ecdd'}, rock:{zh:'岩石',en:'Rock',color:'#f0ede4'},
  ice:{zh:'冰',en:'Ice',color:'#e7f5f6'}, fighting:{zh:'格斗',en:'Fighting',color:'#fae9e3'},
  psychic:{zh:'超能力',en:'Psychic',color:'#faeaf0'}, ghost:{zh:'幽灵',en:'Ghost',color:'#eeeafa'},
  dragon:{zh:'龙',en:'Dragon',color:'#e9ecfa'}, steel:{zh:'钢',en:'Steel',color:'#e9eff1'},
  fairy:{zh:'妖精',en:'Fairy',color:'#fcebf3'},
};
export function searchPokemon(query: string, type = '') {
  const normalized = query.trim().toLocaleLowerCase().replace(/^#/, '');
  return POKEMON_CATALOG.filter(entry => (!type || entry.types.includes(type)) && (!normalized ||
    entry.zh.includes(normalized) || entry.en.toLocaleLowerCase().includes(normalized) ||
    String(entry.dex).padStart(3,'0').includes(normalized)));
}

// Gen 1 paths. Forma level milestones intentionally replace game item/trade requirements.
// Eevee keeps the existing Flareon path; Vaporeon and Jolteon can also be chosen directly.
const chains = [[1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15],[16,17,18],
  [19,20],[21,22],[23,24],[25,26],[27,28],[29,30,31],[32,33,34],[35,36],[37,38],
  [39,40],[41,42],[43,44,45],[46,47],[48,49],[50,51],[52,53],[54,55],[56,57],
  [58,59],[60,61,62],[63,64,65],[66,67,68],[69,70,71],[72,73],[74,75,76],
  [77,78],[79,80],[81,82],[84,85],[86,87],[88,89],[90,91],[92,93,94],[96,97],
  [98,99],[100,101],[102,103],[104,105],[109,110],[111,112],[116,117],[118,119],
  [120,121],[129,130],[133,136],[138,139],[140,141],[147,148,149]];
export function pokemonEvolutionForms(dex: number) {
  const chain = chains.find(chain => chain.includes(dex));
  return (chain ? chain.slice(chain.indexOf(dex)) : [dex]).map((id, index) => {
    const entry = POKEMON_CATALOG.find(entry => entry.dex === id)!;
    return { dex:id, zh:entry.zh, en:entry.en, level:1+index*2 };
  });
}
