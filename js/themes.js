// Puzzle themes. Each theme has:
//  - anchor:   the people (rows of the answer table)
//  - ordered:  one numeric category that powers comparison clues
//  - extras:   a pool of plain categories, two are picked per puzzle
// Phrase templates receive an already-formatted item string and must read
// naturally as a subject ("subj"), a positive predicate ("pos") and a
// negative predicate ("neg").

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const pl = (d, word) => `${d} ${word}${d === 1 ? '' : 's'}`;
const clock = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
const minutes = (d) => (d % 60 === 0 ? pl(d / 60, 'hour') : pl(d, 'minute'));

export const numberWord = (n) => NUM[n] ?? String(n);

export const THEMES = [
  {
    id: 'train',
    title: 'The Night Train',
    icon: '🚂',
    people: 'passengers',
    intro: (n) =>
      `${cap(numberWord(n))} strangers boarded the overnight sleeper from Paris. By morning one of them was missing a pocket watch, and the conductor needs every detail straight.`,
    anchor: { name: 'Passenger', items: ['Ada', 'Bruno', 'Clara', 'Dmitri', 'Elsa', 'Felix', 'Greta', 'Hugo', 'Ines', 'Jonas'] },
    ordered: {
      name: 'Cabin',
      values: [1, 2, 3, 4, 5, 6, 7, 8],
      fmt: (v) => String(v),
      subj: (x) => `the passenger in cabin ${x}`,
      pos: (x) => `is in cabin ${x}`,
      neg: (x) => `is not in cabin ${x}`,
      more: 'is in a higher-numbered cabin than',
      less: 'is in a lower-numbered cabin than',
      diffMore: (d) => `is exactly ${pl(d, 'cabin')} further down the corridor than`,
      diffLess: (d) => `is exactly ${pl(d, 'cabin')} further up the corridor than`,
    },
    extras: [
      {
        name: 'Destination',
        items: ['Vienna', 'Prague', 'Munich', 'Zurich', 'Budapest', 'Salzburg', 'Krakow'],
        subj: (x) => `the passenger bound for ${x}`,
        pos: (x) => `is bound for ${x}`,
        neg: (x) => `is not bound for ${x}`,
      },
      {
        name: 'Luggage',
        items: [['violin case', 'Violin'], ['hatbox', 'Hatbox'], ['birdcage', 'Birdcage'], ['steamer trunk', 'Trunk'], ['briefcase', 'Briefcase'], ['telescope', 'Telescope'], ['typewriter', 'Typewriter']],
        subj: (x) => `the passenger with the ${x}`,
        pos: (x) => `is carrying the ${x}`,
        neg: (x) => `is not carrying the ${x}`,
      },
      {
        name: 'Drink',
        items: ['tea', 'coffee', 'cocoa', 'absinthe', 'lemonade', 'port', 'cider'],
        subj: (x) => `the ${x} drinker`,
        pos: (x) => `ordered ${x}`,
        neg: (x) => `did not order ${x}`,
      },
    ],
  },
  {
    id: 'bake',
    title: 'The Great Bake-Off',
    icon: '🧁',
    people: 'bakers',
    intro: (n) =>
      `${cap(numberWord(n))} home bakers survived to the showstopper round. The judges' scorecards got shuffled with the recipe cards, so sort out who baked what.`,
    anchor: { name: 'Baker', items: ['Amira', 'Ben', 'Cathy', 'Dev', 'Elif', 'Finn', 'Gwen', 'Hamid', 'Iris', 'Jules'] },
    ordered: {
      name: 'Score',
      values: [3, 4, 5, 6, 7, 8, 9, 10],
      fmt: (v) => String(v),
      subj: (x) => `the baker who scored ${x}`,
      pos: (x) => `scored ${x}`,
      neg: (x) => `did not score ${x}`,
      more: 'scored higher than',
      less: 'scored lower than',
      diffMore: (d) => `scored exactly ${pl(d, 'point')} more than`,
      diffLess: (d) => `scored exactly ${pl(d, 'point')} less than`,
    },
    extras: [
      {
        name: 'Bake',
        items: [['éclairs', 'Éclairs'], ['pavlova', 'Pavlova'], ['focaccia', 'Focaccia'], ['strudel', 'Strudel'], ['macarons', 'Macarons'], ['babka', 'Babka'], ['croissants', 'Croissants']],
        subj: (x) => `the baker who made the ${x}`,
        pos: (x) => `made the ${x}`,
        neg: (x) => `did not make the ${x}`,
      },
      {
        name: 'Secret',
        items: ['cardamom', 'miso', 'lavender', 'chili', 'tahini', 'rosewater', 'espresso'],
        subj: (x) => `the baker who used ${x}`,
        pos: (x) => `used ${x}`,
        neg: (x) => `did not use ${x}`,
      },
      {
        name: 'Hometown',
        items: ['Leeds', 'Cardiff', 'Bristol', 'York', 'Belfast', 'Bath', 'Dundee'],
        subj: (x) => `the baker from ${x}`,
        pos: (x) => `is from ${x}`,
        neg: (x) => `is not from ${x}`,
      },
    ],
  },
  {
    id: 'heist',
    title: 'The Midnight Heist',
    icon: '💎',
    people: 'crew members',
    intro: (n) =>
      `A crew of ${numberWord(n)} is inside the Halvorsen Tower. The plan only works if everyone is on the right floor with the right kit, so reconstruct it before the alarms reset.`,
    anchor: { name: 'Codename', items: ['Viper', 'Ghost', 'Magpie', 'Falcon', 'Rook', 'Cipher', 'Jackal', 'Wren', 'Atlas', 'Echo'] },
    ordered: {
      name: 'Floor',
      values: [1, 2, 3, 4, 5, 6, 7, 8],
      fmt: (v) => String(v),
      subj: (x) => `the crew member on floor ${x}`,
      pos: (x) => `is on floor ${x}`,
      neg: (x) => `is not on floor ${x}`,
      more: 'is on a higher floor than',
      less: 'is on a lower floor than',
      diffMore: (d) => `is exactly ${pl(d, 'floor')} above`,
      diffLess: (d) => `is exactly ${pl(d, 'floor')} below`,
    },
    extras: [
      {
        name: 'Role',
        items: [['hacker', 'Hacker'], ['driver', 'Driver'], ['lookout', 'Lookout'], ['safecracker', 'Safecracker'], ['forger', 'Forger'], ['muscle', 'Muscle'], ['grifter', 'Grifter']],
        subj: (x) => `the ${x}`,
        pos: (x) => `is the ${x}`,
        neg: (x) => `is not the ${x}`,
      },
      {
        name: 'Gadget',
        items: [['drone', 'Drone'], ['lockpick', 'Lockpick'], ['grappling hook', 'Grapple'], ['EMP device', 'EMP'], ['night-vision goggles', 'Goggles'], ['glass cutter', 'Cutter'], ['earpiece', 'Earpiece']],
        subj: (x) => `the crew member with the ${x}`,
        pos: (x) => `has the ${x}`,
        neg: (x) => `does not have the ${x}`,
      },
      {
        name: 'Disguise',
        items: [['janitor', 'Janitor'], ['waiter', 'Waiter'], ['tourist', 'Tourist'], ['guard', 'Guard'], ['courier', 'Courier'], ['plumber', 'Plumber'], ['art critic', 'Critic']],
        subj: (x) => `the fake ${x}`,
        pos: (x) => `is posing as the ${x}`,
        neg: (x) => `is not posing as the ${x}`,
      },
    ],
  },
  {
    id: 'dogshow',
    title: 'Best in Show',
    icon: '🐕',
    people: 'handlers',
    intro: (n) =>
      `${cap(numberWord(n))} handlers made the final ring at the county dog show. The program went to print full of typos, so work out who is showing which dog.`,
    anchor: { name: 'Handler', items: ['Alma', 'Boris', 'Chloe', 'Diego', 'Edith', 'Frank', 'Gina', 'Henrik', 'Isla', 'Joel'] },
    ordered: {
      name: 'Dog age',
      values: [2, 3, 4, 5, 6, 7, 8, 9],
      fmt: (v) => String(v),
      short: (v) => `${v}y`,
      subj: (x) => `the handler with the ${x}-year-old dog`,
      pos: (x) => `has the ${x}-year-old dog`,
      neg: (x) => `does not have the ${x}-year-old dog`,
      more: 'has an older dog than',
      less: 'has a younger dog than',
      diffMore: (d) => `has a dog exactly ${pl(d, 'year')} older than the dog of`,
      diffLess: (d) => `has a dog exactly ${pl(d, 'year')} younger than the dog of`,
    },
    extras: [
      {
        name: 'Breed',
        items: [['poodle', 'Poodle'], ['beagle', 'Beagle'], ['corgi', 'Corgi'], ['dalmatian', 'Dalmatian'], ['husky', 'Husky'], ['whippet', 'Whippet'], ['samoyed', 'Samoyed']],
        subj: (x) => `the ${x} handler`,
        pos: (x) => `is showing the ${x}`,
        neg: (x) => `is not showing the ${x}`,
      },
      {
        name: 'Dog',
        items: ['Biscuit', 'Pepper', 'Waffles', 'Duchess', 'Moose', 'Noodle', 'Ziggy'],
        subj: (x) => `the handler of ${x}`,
        pos: (x) => `handles ${x}`,
        neg: (x) => `does not handle ${x}`,
      },
      {
        name: 'Collar',
        items: [['red', 'Red'], ['blue', 'Blue'], ['gold', 'Gold'], ['green', 'Green'], ['purple', 'Purple'], ['silver', 'Silver'], ['orange', 'Orange']],
        subj: (x) => `the handler with the ${x} collar`,
        pos: (x) => `chose the ${x} collar`,
        neg: (x) => `did not choose the ${x} collar`,
      },
    ],
  },
  {
    id: 'station',
    title: 'Orbital Station Kepler',
    icon: '🛰️',
    people: 'astronauts',
    intro: (n) =>
      `${cap(numberWord(n))} astronauts share the next rotation aboard Kepler. Mission Control's roster got corrupted on uplink. Rebuild it from the crew's radio chatter.`,
    anchor: { name: 'Astronaut', items: ['Anya', 'Bao', 'Carmen', 'Dara', 'Emeka', 'Freya', 'Goran', 'Hana', 'Idris', 'Juno'] },
    ordered: {
      name: 'Shift',
      values: [0, 120, 240, 360, 480, 600, 720, 840],
      fmt: (v) => clock(v).padStart(5, '0'),
      short: (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}h`,
      subj: (x) => `the astronaut whose shift starts at ${x}`,
      pos: (x) => `starts their shift at ${x}`,
      neg: (x) => `does not start their shift at ${x}`,
      more: 'starts their shift later than',
      less: 'starts their shift earlier than',
      diffMore: (d) => `starts their shift exactly ${minutes(d)} later than`,
      diffLess: (d) => `starts their shift exactly ${minutes(d)} earlier than`,
    },
    extras: [
      {
        name: 'Module',
        items: ['Kibo', 'Zvezda', 'Destiny', 'Unity', 'Harmony', 'Tranquility', 'Columbus'],
        subj: (x) => `the astronaut in ${x}`,
        pos: (x) => `works in ${x}`,
        neg: (x) => `does not work in ${x}`,
      },
      {
        name: 'Experiment',
        items: [['algae', 'Algae'], ['crystals', 'Crystals'], ['fruit flies', 'Flies'], ['plasma', 'Plasma'], ['bone density', 'Bones'], ['fungi', 'Fungi'], ['dust', 'Dust']],
        subj: (x) => `the astronaut studying ${x}`,
        pos: (x) => `is studying ${x}`,
        neg: (x) => `is not studying ${x}`,
      },
      {
        name: 'Comfort food',
        items: [['ramen', 'Ramen'], ['borscht', 'Borscht'], ['tacos', 'Tacos'], ['jollof', 'Jollof'], ['pierogi', 'Pierogi'], ['curry', 'Curry'], ['paella', 'Paella']],
        subj: (x) => `the astronaut who packed ${x}`,
        pos: (x) => `packed ${x}`,
        neg: (x) => `did not pack ${x}`,
      },
    ],
  },
  {
    id: 'marathon',
    title: 'The City Marathon',
    icon: '🏃',
    people: 'runners',
    intro: (n) =>
      `${cap(numberWord(n))} friends ran the city marathon together but finished apart. The results app crashed, so piece together who ran what from their post-race bragging.`,
    anchor: { name: 'Runner', items: ['Ayla', 'Bram', 'Cora', 'Dante', 'Esme', 'Fabio', 'Gia', 'Hiro', 'Ivy', 'Kai'] },
    ordered: {
      name: 'Finish',
      values: [185, 190, 195, 200, 205, 210, 215, 220],
      fmt: (v) => clock(v),
      subj: (x) => `the runner who finished in ${x}`,
      pos: (x) => `finished in ${x}`,
      neg: (x) => `did not finish in ${x}`,
      more: 'finished after',
      less: 'finished before',
      diffMore: (d) => `finished exactly ${minutes(d)} after`,
      diffLess: (d) => `finished exactly ${minutes(d)} before`,
    },
    extras: [
      {
        name: 'Socks',
        items: [['striped', 'Striped'], ['polka-dot', 'Polka'], ['argyle', 'Argyle'], ['neon', 'Neon'], ['tie-dye', 'Tie-dye'], ['plaid', 'Plaid'], ['camo', 'Camo']],
        subj: (x) => `the runner in ${x} socks`,
        pos: (x) => `wore ${x} socks`,
        neg: (x) => `did not wear ${x} socks`,
      },
      {
        name: 'Snack',
        items: [['banana', 'Banana'], ['energy gel', 'Gel'], ['pretzels', 'Pretzels'], ['gummy bears', 'Gummies'], ['dates', 'Dates'], ['orange slices', 'Oranges'], ['honey waffle', 'Waffle']],
        subj: (x) => `the runner who ate the ${x}`,
        pos: (x) => `ate the ${x}`,
        neg: (x) => `did not eat the ${x}`,
      },
      {
        name: 'Hometown',
        items: ['Oslo', 'Lyon', 'Porto', 'Ghent', 'Turin', 'Graz', 'Malmö'],
        subj: (x) => `the runner from ${x}`,
        pos: (x) => `is from ${x}`,
        neg: (x) => `is not from ${x}`,
      },
    ],
  },
  {
    id: 'masquerade',
    title: 'The Masquerade',
    icon: '🎭',
    people: 'guests',
    intro: (n) =>
      `${cap(numberWord(n))} masked guests arrived at Lady Ashcombe's ball, and each was hiding something. Unmask the evening before the clock strikes midnight.`,
    anchor: { name: 'Guest', items: ['Aurelia', 'Basil', 'Cosima', 'Darius', 'Eloise', 'Florian', 'Giselle', 'Horatio', 'Imogen', 'Julian'] },
    ordered: {
      name: 'Arrival',
      values: [480, 495, 510, 525, 540, 555, 570, 585],
      fmt: (v) => clock(v),
      subj: (x) => `the guest who arrived at ${x}`,
      pos: (x) => `arrived at ${x}`,
      neg: (x) => `did not arrive at ${x}`,
      more: 'arrived later than',
      less: 'arrived earlier than',
      diffMore: (d) => `arrived exactly ${minutes(d)} after`,
      diffLess: (d) => `arrived exactly ${minutes(d)} before`,
    },
    extras: [
      {
        name: 'Mask',
        items: [['fox', 'Fox'], ['raven', 'Raven'], ['lion', 'Lion'], ['moth', 'Moth'], ['stag', 'Stag'], ['owl', 'Owl'], ['swan', 'Swan']],
        subj: (x) => `the guest in the ${x} mask`,
        pos: (x) => `wore the ${x} mask`,
        neg: (x) => `did not wear the ${x} mask`,
      },
      {
        name: 'Secret',
        items: [['forged will', 'Will'], ['stolen ruby', 'Ruby'], ['poison vial', 'Poison'], ['love letter', 'Letter'], ['pawn ticket', 'Ticket'], ['treasure map', 'Map'], ['false passport', 'Passport']],
        subj: (x) => `the guest hiding the ${x}`,
        pos: (x) => `is hiding the ${x}`,
        neg: (x) => `is not hiding the ${x}`,
      },
      {
        name: 'Drink',
        items: [['champagne', 'Champagne'], ['sherry', 'Sherry'], ['punch', 'Punch'], ['gin fizz', 'Gin fizz'], ['mead', 'Mead'], ['vermouth', 'Vermouth'], ['claret', 'Claret']],
        subj: (x) => `the guest sipping ${x}`,
        pos: (x) => `is sipping ${x}`,
        neg: (x) => `is not sipping ${x}`,
      },
    ],
  },
];

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
