/** Fixed scene art — emoji only (no image API). */
export const STORY_SCENES = {
  home: { emoji: '🏠', labelEn: 'Home', labelBo: 'ཁྱིམ།' },
  school: { emoji: '🏫', labelEn: 'School', labelBo: 'སློབ་གྲྭ།' },
  mountain: { emoji: '⛰️', labelEn: 'Mountain', labelBo: 'རི།' },
  river: { emoji: '🌊', labelEn: 'River', labelBo: 'ཆུ་བོ།' },
  forest: { emoji: '🌲', labelEn: 'Forest', labelBo: 'ནགས་ཚལ།' },
  village: { emoji: '🏡', labelEn: 'Village', labelBo: 'གྲོང་ཚོ།' },
  market: { emoji: '🧺', labelEn: 'Market', labelBo: 'ཁྲོམ།' },
  temple: { emoji: '🛕', labelEn: 'Temple', labelBo: 'ལྷ་ཁང་།' },
  sky: { emoji: '☁️', labelEn: 'Sky', labelBo: 'ནམ་མཁའ།' },
  night: { emoji: '🌙', labelEn: 'Night', labelBo: 'མཚན་མོ།' },
  friend: { emoji: '🤝', labelEn: 'Friends', labelBo: 'གྲོགས་པོ།' },
  animal: { emoji: '🐄', labelEn: 'Animals', labelBo: 'སེམས་ཅན།' },
  food: { emoji: '🍲', labelEn: 'Food', labelBo: 'ཟས།' },
  play: { emoji: '⚽', labelEn: 'Play', labelBo: 'རྩེད་མོ།' },
  help: { emoji: '💛', labelEn: 'Helping', labelBo: 'རོགས་རམ།' },
  travel: { emoji: '🚶', labelEn: 'Travel', labelBo: 'འགྲུལ་བཞུད།' },
  rain: { emoji: '🌧️', labelEn: 'Rain', labelBo: 'ཆར་པ།' },
  sun: { emoji: '☀️', labelEn: 'Sun', labelBo: 'ཉི་མ།' },
  snow: { emoji: '❄️', labelEn: 'Snow', labelBo: 'ཁ་བ།' },
  celebration: { emoji: '🎉', labelEn: 'Celebration', labelBo: 'དགའ་སྟོན།' },
}

export function sceneArt(key, isEn = false) {
  const row = STORY_SCENES[key] || STORY_SCENES.play
  return {
    emoji: row.emoji,
    label: isEn ? row.labelEn : row.labelBo,
  }
}
