// Tibetan learning content: 30 consonants + 4 vowels + vocab + lessons.
// Wylie transliteration follows the standard Extended Wylie system.

export const CONSONANTS = [
  { id: "c1", letter: "ཀ", wylie: "ka", latin: "ka", group: "velar" },
  { id: "c2", letter: "ཁ", wylie: "kha", latin: "kha", group: "velar" },
  { id: "c3", letter: "ག", wylie: "ga", latin: "ga", group: "velar" },
  { id: "c4", letter: "ང", wylie: "nga", latin: "nga", group: "velar" },
  { id: "c5", letter: "ཅ", wylie: "ca", latin: "cha", group: "palatal" },
  { id: "c6", letter: "ཆ", wylie: "cha", latin: "chha", group: "palatal" },
  { id: "c7", letter: "ཇ", wylie: "ja", latin: "ja", group: "palatal" },
  { id: "c8", letter: "ཉ", wylie: "nya", latin: "nya", group: "palatal" },
  { id: "c9", letter: "ཏ", wylie: "ta", latin: "ta", group: "dental" },
  { id: "c10", letter: "ཐ", wylie: "tha", latin: "tha", group: "dental" },
  { id: "c11", letter: "ད", wylie: "da", latin: "da", group: "dental" },
  { id: "c12", letter: "ན", wylie: "na", latin: "na", group: "dental" },
  { id: "c13", letter: "པ", wylie: "pa", latin: "pa", group: "labial" },
  { id: "c14", letter: "ཕ", wylie: "pha", latin: "pha", group: "labial" },
  { id: "c15", letter: "བ", wylie: "ba", latin: "ba", group: "labial" },
  { id: "c16", letter: "མ", wylie: "ma", latin: "ma", group: "labial" },
  { id: "c17", letter: "ཙ", wylie: "tsa", latin: "tsa", group: "affricate" },
  { id: "c18", letter: "ཚ", wylie: "tsha", latin: "tsha", group: "affricate" },
  { id: "c19", letter: "ཛ", wylie: "dza", latin: "dza", group: "affricate" },
  { id: "c20", letter: "ཝ", wylie: "wa", latin: "wa", group: "semivowel" },
  { id: "c21", letter: "ཞ", wylie: "zha", latin: "zha", group: "sibilant" },
  { id: "c22", letter: "ཟ", wylie: "za", latin: "za", group: "sibilant" },
  { id: "c23", letter: "འ", wylie: "'a", latin: "a", group: "guttural" },
  { id: "c24", letter: "ཡ", wylie: "ya", latin: "ya", group: "semivowel" },
  { id: "c25", letter: "ར", wylie: "ra", latin: "ra", group: "liquid" },
  { id: "c26", letter: "ལ", wylie: "la", latin: "la", group: "liquid" },
  { id: "c27", letter: "ཤ", wylie: "sha", latin: "sha", group: "sibilant" },
  { id: "c28", letter: "ས", wylie: "sa", latin: "sa", group: "sibilant" },
  { id: "c29", letter: "ཧ", wylie: "ha", latin: "ha", group: "guttural" },
  { id: "c30", letter: "ཨ", wylie: "a", latin: "a", group: "guttural" },
];

export const VOWELS = [
  { id: "v1", letter: "ཨི", wylie: "i", latin: "i" },
  { id: "v2", letter: "ཨུ", wylie: "u", latin: "u" },
  { id: "v3", letter: "ཨེ", wylie: "e", latin: "e" },
  { id: "v4", letter: "ཨོ", wylie: "o", latin: "o" },
];

export const VOCAB = [
  { id: "w1", tibetan: "བཀྲ་ཤིས་བདེ་ལེགས།", wylie: "bkra shis bde legs", english: "Hello / Blessings", theme: "greetings" },
  { id: "w2", tibetan: "ཐུགས་རྗེ་ཆེ།", wylie: "thugs rje che", english: "Thank you", theme: "greetings" },
  { id: "w3", tibetan: "དགོངས་དག", wylie: "dgongs dag", english: "Sorry / Excuse me", theme: "greetings" },
  { id: "w4", tibetan: "ཨ་མ", wylie: "a ma", english: "Mother", theme: "family" },
  { id: "w5", tibetan: "ཨ་པ", wylie: "a pa", english: "Father", theme: "family" },
  { id: "w6", tibetan: "བུ", wylie: "bu", english: "Son / boy", theme: "family" },
  { id: "w7", tibetan: "བུ་མོ", wylie: "bu mo", english: "Daughter / girl", theme: "family" },
  { id: "w8", tibetan: "ཆུ", wylie: "chu", english: "Water", theme: "nature" },
  { id: "w9", tibetan: "རི", wylie: "ri", english: "Mountain", theme: "nature" },
  { id: "w10", tibetan: "ཉི་མ", wylie: "nyi ma", english: "Sun", theme: "nature" },
  { id: "w11", tibetan: "ཟླ་བ", wylie: "zla ba", english: "Moon", theme: "nature" },
  { id: "w12", tibetan: "མེ་ཏོག", wylie: "me tog", english: "Flower", theme: "nature" },
  { id: "w13", tibetan: "སྐར་མ", wylie: "skar ma", english: "Star", theme: "nature" },
  { id: "w14", tibetan: "ཁྱི", wylie: "khyi", english: "Dog", theme: "animals" },
  { id: "w15", tibetan: "ཞི་མི", wylie: "zhi mi", english: "Cat", theme: "animals" },
  { id: "w16", tibetan: "རྟ", wylie: "rta", english: "Horse", theme: "animals" },
  { id: "w17", tibetan: "གཡག", wylie: "g.yag", english: "Yak", theme: "animals" },
  { id: "w18", tibetan: "བྱ", wylie: "bya", english: "Bird", theme: "animals" },
  { id: "w19", tibetan: "ཇ", wylie: "ja", english: "Tea", theme: "food" },
  { id: "w20", tibetan: "འབྲས", wylie: "'bras", english: "Rice", theme: "food" },
  { id: "w21", tibetan: "ཤ", wylie: "sha", english: "Meat", theme: "food" },
  { id: "w22", tibetan: "འོ་མ", wylie: "'o ma", english: "Milk", theme: "food" },
  { id: "w23", tibetan: "ཁྱེད་རང", wylie: "khyed rang", english: "You (polite)", theme: "pronouns" },
  { id: "w24", tibetan: "ང", wylie: "nga", english: "I / me", theme: "pronouns" },
  { id: "w25", tibetan: "ཁོ", wylie: "kho", english: "He", theme: "pronouns" },
  { id: "w26", tibetan: "མོ", wylie: "mo", english: "She", theme: "pronouns" },
  { id: "w27", tibetan: "གཅིག", wylie: "gcig", english: "One", theme: "numbers" },
  { id: "w28", tibetan: "གཉིས", wylie: "gnyis", english: "Two", theme: "numbers" },
  { id: "w29", tibetan: "གསུམ", wylie: "gsum", english: "Three", theme: "numbers" },
  { id: "w30", tibetan: "བཞི", wylie: "bzhi", english: "Four", theme: "numbers" },
  { id: "w31", tibetan: "ལྔ", wylie: "lnga", english: "Five", theme: "numbers" },
];

export const LESSONS = [
  {
    id: "l1",
    title: "First Greetings",
    tibetan_title: "འཚམས་འདྲི་དང་པོ།",
    focus: "Everyday greetings & polite phrases",
    level: "Beginner",
    minutes: 8,
    words: ["w1", "w2", "w3"],
    dialogue: [
      { speaker: "A", tibetan: "བཀྲ་ཤིས་བདེ་ལེགས།", wylie: "bkra shis bde legs", english: "Hello!" },
      { speaker: "B", tibetan: "བཀྲ་ཤིས་བདེ་ལེགས། ཁྱེད་རང་སྐུ་ཁམས་བཟང་ངམ།", wylie: "bkra shis bde legs. khyed rang sku khams bzang ngam.", english: "Hello! How are you?" },
      { speaker: "A", tibetan: "བཟང་པོ་ཡོད། ཐུགས་རྗེ་ཆེ།", wylie: "bzang po yod. thugs rje che.", english: "I'm well, thank you." },
    ],
    notes: "Tibetan greetings often use the phrase bkra shis bde legs, literally 'auspiciousness and well-being'. It's used for hello, goodbye, and general good wishes.",
    quiz: [
      { q: "What does བཀྲ་ཤིས་བདེ་ལེགས། mean?", options: ["Sorry", "Hello / Blessings", "Goodnight", "Please"], answer: 1 },
      { q: "How do you say 'thank you' in Tibetan?", options: ["ཐུགས་རྗེ་ཆེ།", "དགོངས་དག", "ང", "ཤ"], answer: 0 },
      { q: "The word དགོངས་དག means…", options: ["Hello", "Mountain", "Sorry / Excuse me", "Yak"], answer: 2 },
    ],
  },
  {
    id: "l2",
    title: "Family Words",
    tibetan_title: "ནང་མིའི་མིང་ཚིག",
    focus: "Family & pronouns",
    level: "Beginner",
    minutes: 10,
    words: ["w4", "w5", "w6", "w7", "w23", "w24"],
    dialogue: [
      { speaker: "A", tibetan: "འདི་ང་ཡི་ཨ་མ་ཡིན།", wylie: "'di nga yi a ma yin", english: "This is my mother." },
      { speaker: "B", tibetan: "ཁོ་ཁྱེད་ཀྱི་ཨ་པ་རེད་དམ།", wylie: "kho khyed kyi a pa red dam", english: "Is he your father?" },
    ],
    notes: "Kinship terms like a ma (mother) and a pa (father) are informal. In writing, ཡབ (yab) for father and ཡུམ (yum) for mother appear in formal or honorific registers.",
    quiz: [
      { q: "ཨ་མ means…", options: ["Father", "Mother", "Son", "Daughter"], answer: 1 },
      { q: "Which one means 'I / me'?", options: ["ང", "ཁོ", "མོ", "བུ"], answer: 0 },
      { q: "བུ་མོ means…", options: ["Boy", "Girl / daughter", "Grandma", "Baby"], answer: 1 },
    ],
  },
  {
    id: "l3",
    title: "The Natural World",
    tibetan_title: "རང་བྱུང་ཁོར་ཡུག",
    focus: "Nature vocabulary",
    level: "Beginner",
    minutes: 12,
    words: ["w8", "w9", "w10", "w11", "w12", "w13"],
    dialogue: [
      { speaker: "A", tibetan: "ཉི་མ་ཤར་སོང་།", wylie: "nyi ma shar song", english: "The sun has risen." },
      { speaker: "B", tibetan: "རི་བོའི་སྟེང་ན་སྐར་མ་གསལ་པོ་འདུག", wylie: "ri bo'i steng na skar ma gsal po 'dug", english: "The stars are bright above the mountain." },
    ],
    notes: "Tibetan poetry heavily draws on nature imagery — sun, moon, mountains, and clouds. Notice how these single-syllable words combine to form richer expressions.",
    quiz: [
      { q: "ཆུ means…", options: ["Fire", "Water", "Wind", "Earth"], answer: 1 },
      { q: "'Moon' in Tibetan is…", options: ["ཉི་མ", "སྐར་མ", "ཟླ་བ", "རི"], answer: 2 },
      { q: "རི translates as…", options: ["River", "Mountain", "Rock", "Sky"], answer: 1 },
    ],
  },
  {
    id: "l4",
    title: "Counting to Five",
    tibetan_title: "གྲངས་ཀ་ལྔ།",
    focus: "Numbers 1–5",
    level: "Beginner",
    minutes: 6,
    words: ["w27", "w28", "w29", "w30", "w31"],
    dialogue: [
      { speaker: "A", tibetan: "གཅིག་གཉིས་གསུམ་བཞི་ལྔ།", wylie: "gcig gnyis gsum bzhi lnga", english: "One two three four five." },
    ],
    notes: "Tibetan digits also have their own script forms (༡ ༢ ༣ ༤ ༥). The spoken names are easy to memorise with rhythmic repetition.",
    quiz: [
      { q: "Which one means 'three'?", options: ["གཅིག", "གཉིས", "གསུམ", "བཞི"], answer: 2 },
      { q: "ལྔ means…", options: ["Two", "Four", "Five", "Ten"], answer: 2 },
      { q: "The number 'one' is…", options: ["གཅིག", "གཉིས", "གསུམ", "བཞི"], answer: 0 },
    ],
  },
];

export function getLesson(id) {
  return LESSONS.find((l) => l.id === id);
}
export function getWords(ids) {
  return VOCAB.filter((w) => ids.includes(w.id));
}
