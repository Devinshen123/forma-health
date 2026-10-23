import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POKEMON_CATALOG, POKEMON_TYPES, pokemonCharacter, searchPokemon } from '../src/pokemon-catalog';
import { companionForm, COMPANION_EVOLUTIONS } from '../src/companion-growth';

test('the catalog contains every Kanto ID exactly once, searchable in both languages and by number',()=>{
  assert.deepEqual(POKEMON_CATALOG.map(entry=>entry.dex),Array.from({length:151},(_,index)=>index+1));
  assert.equal(new Set(POKEMON_CATALOG.map(entry=>entry.en)).size,151);
  assert.equal(searchPokemon('小火龙')[0].dex,4);assert.equal(searchPokemon('chARizard')[0].dex,6);
  assert.equal(searchPokemon('#151')[0].zh,'梦幻');assert.equal(searchPokemon('004')[0].dex,4);
  assert.equal(searchPokemon('no such species').length,0);
  assert.ok(searchPokemon('','water').every(entry=>entry.types.includes('water')));
  assert.equal(searchPokemon('皮卡丘','water').length,0);
  for(const entry of POKEMON_CATALOG){
    assert.ok(entry.types.every(type=>POKEMON_TYPES[type]));
    const character=pokemonCharacter(entry.dex),forms=COMPANION_EVOLUTIONS[character];
    assert.equal(companionForm(character,1).dex,entry.dex,'each catalog card can show its exact species');
    assert.ok(forms.every(form=>form.dex>=1&&form.dex<=151));
    assert.equal(companionForm(character,999).dex,forms.at(-1)!.dex);
  }
});
