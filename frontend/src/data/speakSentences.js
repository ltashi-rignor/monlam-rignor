/** Kid-friendly Tibetan sentences for guided speaking (repeat-after-me). */
export const SPEAK_SENTENCES = [
  {
    id: 's1',
    tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས།',
    meaning: 'Hello!',
    meaningBo: 'འཚམས་འདྲི།',
    topic: 'greetings',
  },
  {
    id: 's2',
    tibetan: 'ཁྱེད་རང་སྐུ་ཁམས་བཟང་ངམ།',
    meaning: 'How are you?',
    meaningBo: 'ཁྱེད་རང་བདེ་པོ་ཡིན་ནམ།',
    topic: 'greetings',
  },
  {
    id: 's3',
    tibetan: 'ང་བཟང་པོ་ཡོད། ཐུགས་རྗེ་ཆེ།',
    meaning: 'I am well. Thank you.',
    meaningBo: 'ང་བདེ་པོ་ཡོད། ཐུགས་རྗེ་ཆེ།',
    topic: 'greetings',
  },
  {
    id: 's4',
    tibetan: 'ངའི་མིང་ལ་པད་མ་ཟེར།',
    meaning: 'My name is Pema.',
    meaningBo: 'ངའི་མིང་པད་མ་རེད།',
    topic: 'intro',
  },
  {
    id: 's5',
    tibetan: 'ང་སློབ་གྲྭ་ལ་འགྲོ།',
    meaning: 'I go to school.',
    meaningBo: 'ང་སློབ་གྲྭར་འགྲོ།',
    topic: 'daily',
  },
  {
    id: 's6',
    tibetan: 'དེ་རིང་ཉི་མ་ཡག་པོ་འདུག',
    meaning: 'The sun is nice today.',
    meaningBo: 'དེ་རིང་ཉི་མ་ཡག་པོ་འདུག',
    topic: 'daily',
  },
  {
    id: 's7',
    tibetan: 'ང་ཆུ་འཐུང་གི་ཡོད།',
    meaning: 'I am drinking water.',
    meaningBo: 'ང་ཆུ་འཐུང་བཞིན་ཡོད།',
    topic: 'daily',
  },
  {
    id: 's8',
    tibetan: 'འདི་ང་ཡི་ཨ་མ་ཡིན།',
    meaning: 'This is my mother.',
    meaningBo: 'འདི་ངའི་ཨ་མ་ཡིན།',
    topic: 'family',
  },
  {
    id: 's9',
    tibetan: 'ཁོ་ངའི་ཨ་པ་རེད།',
    meaning: 'He is my father.',
    meaningBo: 'ཁོ་ངའི་ཨ་པ་རེད།',
    topic: 'family',
  },
  {
    id: 's10',
    tibetan: 'ང་ཁ་ལག་ཟ་གི་ཡོད།',
    meaning: 'I am eating food.',
    meaningBo: 'ང་ཁ་ལག་ཟ་བཞིན་ཡོད།',
    topic: 'daily',
  },
  {
    id: 's11',
    tibetan: 'ཉི་མ་ཤར་སོང་།',
    meaning: 'The sun has risen.',
    meaningBo: 'ཉི་མ་ཤར་སོང་།',
    topic: 'nature',
  },
  {
    id: 's12',
    tibetan: 'ང་དཔེ་ཆ་ཀློག་གི་ཡོད།',
    meaning: 'I am reading a book.',
    meaningBo: 'ང་དཔེ་ཆ་ཀློག་བཞིན་ཡོད།',
    topic: 'school',
  },
  {
    id: 's13',
    tibetan: 'ཁྱེད་རང་ག་པར་ཕེབས་ཀྱི་ཡོད།',
    meaning: 'Where are you going?',
    meaningBo: 'ཁྱེད་རང་ག་པར་འགྲོ་གི་ཡོད།',
    topic: 'daily',
  },
  {
    id: 's14',
    tibetan: 'ང་ནང་ལ་ལོག་གི་ཡིན།',
    meaning: 'I am going home.',
    meaningBo: 'ང་ནང་ལ་ལོག་གི་ཡིན།',
    topic: 'daily',
  },
  {
    id: 's15',
    tibetan: 'ཐུགས་རྗེ་ཆེ། ཁ་སང་མཇལ་ཡོང་།',
    meaning: 'Thank you. See you tomorrow.',
    meaningBo: 'ཐུགས་རྗེ་ཆེ། སང་ཉིན་མཇལ་ཡོང་།',
    topic: 'greetings',
  },
]

export function listenMsForSentence(text) {
  const len = String(text || '').replace(/\s+/g, '').length
  // Longer lines need more mic time; clamp 5–9s
  return Math.min(9000, Math.max(5000, 3500 + len * 45))
}
