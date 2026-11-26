import type { VrtMessages } from '../messages';
import type { Level } from '../types';

const LEVEL_NAMES: Record<Level, string> = { 1: 'categorie', 2: 'subcategorie', 3: 'variant' };

/** Dutch catalog. Node names stay as the taxonomy gives them. */
export const nl: VrtMessages = {
  locale: 'nl',
  levels: { 1: 'Categorie', 2: 'Subcategorie', 3: 'Variant' },
  priority: {
    label: 'Prioriteit',
    names: { 1: 'Kritiek', 2: 'Hoog', 3: 'Gemiddeld', 4: 'Laag', 5: 'Informatief' },
    varies: 'Varieert',
  },
  issues: {
    TOO_LONG: (p) => `De ID is langer dan ${p.max} tekens.`,
    INVALID_FORMAT: () =>
      'Een VRT-ID bestaat uit één tot drie namen van kleine letters, cijfers en underscores, gescheiden door punten.',
    TOO_DEEP: () => 'Een VRT-ID heeft hoogstens drie niveaus: categorie, subcategorie en variant.',
    UNKNOWN_ID: (p) =>
      p.parentName === null
        ? `"${p.id}" is geen VRT-categorie.`
        : `"${p.id}" is geen ${LEVEL_NAMES[p.level]} van ${p.parentName}.`,
    DEPRECATED: (p) =>
      p.replacementName
        ? `"${p.id}" is uit de VRT verwijderd en vervangen door ${p.replacementName}.`
        : `"${p.id}" is uit de VRT verwijderd, zonder directe vervanging.`,
    INCOMPLETE: (p) => `Kies een ${LEVEL_NAMES[p.level]} van ${p.name}.`,
    NOT_CANONICAL: (p) => `VRT-ID's bestaan uit kleine letters, zonder spaties: ${p.normalized}.`,
  },
  ui: {
    label: 'Type kwetsbaarheid',
    placeholder: 'Kies een type kwetsbaarheid',
    filter: 'Typen kwetsbaarheid filteren',
    filterPlaceholder: 'Typ om te filteren, zoals "stored xss"',
    results: (n) => (n === 1 ? '1 resultaat' : `${n} resultaten`),
    noResults: 'Geen passende typen kwetsbaarheid.',
    choose: { 1: 'Kies een categorie', 2: 'Kies een subcategorie', 3: 'Kies een variant' },
    noSpecific: { 2: 'Geen specifieke subcategorie', 3: 'Geen specifieke variant' },
    notApplicable: 'Niet van toepassing',
    childCount: (n) => (n === 1 ? ', 1 optie' : `, ${n} opties`),
    useReplacement: (name) => `${name} gebruiken`,
    clear: 'Wissen',
    error: 'Fout',
    warning: 'Waarschuwing',
    pathSeparator: ' › ',
    taxonomyVersion: (v) => `VRT ${v}`,
  },
};
