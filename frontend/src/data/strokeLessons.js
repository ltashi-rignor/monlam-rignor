/**
 * Step-by-step dbu-can handwriting lessons.
 *
 * Stroke order, part names, and proportions follow Christopher J. Fynn:
 * https://sites.google.com/view/chrisfynn/home/tibetanscriptfonts/howtowritethetibetanscript
 *
 * Rules from Fynn:
 * - Head (མགོ) is drawn first (left → right), except special forms like ཨ.
 * - Remaining strokes: top → bottom, left → right.
 * - Horizontals L→R; verticals top→down.
 * - Letters hang from the head line (not sit on a baseline).
 *
 * Paths use a 0–100 box. Head sits near y=18–22 (between guide lines 1–2).
 * Guide lines: y = 18, 36, 54, 72, 90 (Fynn-style staff).
 */

function lesson(slug, steps) {
  return {
    strokeCount: steps.length,
    image: `/handwriting/fynn/${slug}.jpg`,
    source: 'Chris Fynn',
    steps,
  }
}

function step(bo, en, path) {
  return { bo, en, path }
}

const MGO = 'མགོ།'
const MGO_EN = 'Head (mgo): thick top stroke, left → right.'

export const STROKE_LESSONS = {
  // ཀ — Fynn: མགོ → མཆེ་བ → དབུས་ལག → རྐང་པ
  // Paths tuned to Monlam Uni OuChan2 proportions (open left wedge, short mid, long right).
  c1: lesson('ka', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [12, 20],
      [50, 18],
      [88, 20],
    ]),
    step('མཆེ་བ། གཡོན་ནས་གུག་སྟེ་མར།', 'Tusk (mche ba): short left curve down from the head.', [
      [28, 22],
      [18, 34],
      [14, 48],
      [22, 58],
    ]),
    step('དབུས་ལག དབུས་ནས་མར།', 'Middle leg (dbus lag): center stem down to the lower guide.', [
      [48, 22],
      [48, 38],
      [50, 62],
    ]),
    step('རྐང་པ། གཡས་ནས་རིང་པོར་མར།', 'Foot (rkang pa): long right stem down to the bottom guide.', [
      [72, 22],
      [74, 50],
      [76, 92],
    ]),
  ]),

  // ཁ — Fynn: མགོ → ལག་པ → དཔུང་པ → སྒལ → སོག་པ
  c2: lesson('kha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [20, 22],
      [80, 18],
    ]),
    step('ལག་པ། གཡོན་གྱི་ཐད་ཀར་མར།', 'Arm (lag pa): long left vertical from the head.', [
      [28, 20],
      [28, 48],
      [30, 82],
    ]),
    step('དཔུང་པ། ནང་གི་ཐིག་མར།', 'Shoulder (dpung pa): short inner drop from the head.', [
      [46, 20],
      [44, 34],
      [42, 48],
    ]),
    step('སྒལ། གུག་ཐིག་གཡོན་ནས་གཡས།', 'Back (sgal): abdominal curve left → right.', [
      [42, 48],
      [52, 56],
      [68, 54],
      [74, 48],
    ]),
    step('སོག་པ། གཡས་ནས་མར།', 'Shoulder-blade (sog pa): right stem closing the form.', [
      [74, 20],
      [74, 36],
      [74, 52],
    ]),
  ]),

  // ག — Fynn: མགོ → དཔྱང་རྩ → ལྟོ → དབུས་ལག → རྐང་པ
  c3: lesson('ga', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('དཔྱང་རྩ། གཡོན་ནས་གུག་སྟེ་མར།', 'Hanging root (dpyang rtsa): left curve down from the head.', [
      [32, 20],
      [30, 32],
      [28, 46],
    ]),
    step('ལྟོ། གུག་ཐིག་མར་དང་གཡས།', 'Belly (lto): continue the left body curve down/right.', [
      [28, 46],
      [32, 58],
      [42, 66],
      [54, 64],
    ]),
    step('དབུས་ལག དབུས་ནས་མར།', 'Middle leg (dbus lag): center stem down.', [
      [58, 20],
      [58, 40],
      [58, 62],
    ]),
    step('རྐང་པ། གཡས་ནས་རིང་པོར་མར།', 'Foot (rkang pa): long right stem to the bottom.', [
      [72, 20],
      [74, 50],
      [76, 88],
    ]),
  ]),

  // ང — Fynn: མགོ → དཔུང་པ → སྐོ
  c4: lesson('nga', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [24, 22],
      [76, 18],
    ]),
    step('དཔུང་པ། དབུས་གཡོན་ནས་མར།', 'Shoulder (dpung pa): stem down from under the head.', [
      [42, 20],
      [40, 36],
      [38, 52],
    ]),
    step('སྐོ། གུག་ཐིག་གཡོན་ནས་གཡས།', 'Turn (sko): bottom curve left → right from the shoulder.', [
      [38, 52],
      [48, 64],
      [62, 66],
      [74, 58],
    ]),
  ]),

  // ཅ — Fynn: མགོ → སྐེ → མཆུ་ཕྱུང → རྐང་པ
  c5: lesson('ca', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('སྐེ། དབུས་ནས་གུག་སྟེ་གཡོན།', 'Neck (ske): drop from mid-head, hook left.', [
      [52, 20],
      [50, 34],
      [42, 44],
      [34, 40],
    ]),
    step('མཆུ་ཕྱུང་བ། གུག་སྟེ་གཡས་མར།', 'Protruding lip: curve down and out to the right.', [
      [34, 42],
      [38, 52],
      [50, 58],
      [62, 54],
    ]),
    step('རྐང་པ། མར་འབབ།', 'Foot (rkang pa): vertical down from the junction.', [
      [50, 48],
      [52, 68],
      [54, 88],
    ]),
  ]),

  // ཆ — Fynn: མགོ → སྐེད/གང་ཆགས → འོག་འཛུམ
  c6: lesson('cha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [20, 22],
      [80, 18],
    ]),
    step('སྐེད་དང་གང་ཆགས། གཡོན་གྱི་འཁོར་ཐིག།', 'Waist loop: counter-clockwise left body from the stem.', [
      [48, 20],
      [46, 36],
      [36, 48],
      [28, 42],
      [34, 32],
      [44, 36],
    ]),
    step('འོག་འཛུམ། གཡས་ཀྱི་འཁོར་ཐིག།', 'Lower smile: second counter-clockwise loop on the right.', [
      [52, 36],
      [58, 48],
      [70, 46],
      [68, 34],
      [56, 32],
    ]),
  ]),

  // ཇ — Fynn: མགོ → དཔུང་པ → སྒལ → དཀྱིལ་ལག
  c7: lesson('ja', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder (dpung pa): left descending curve.', [
      [30, 20],
      [28, 36],
      [30, 52],
    ]),
    step('སྒལ། གུག་ཐིག་མར་གཡས།', 'Back (sgal): wide curve down and right.', [
      [30, 40],
      [38, 58],
      [52, 70],
      [70, 72],
      [82, 64],
    ]),
    step('དཀྱིལ་ལག དབུས་ཐིག་གཡོན་ནས་གཡས།', 'Middle hand (dkyil lag): short mid stroke left → right.', [
      [36, 40],
      [48, 42],
      [58, 40],
    ]),
  ]),

  // ཉ — Fynn: མགོ → སྟོད་ཕུབ → ཉག་སྐེ → དབུས་ལག → རྐེད་པ་དང་རྐང་པ
  c8: lesson('nya', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('སྟོད་ཕུབ། གཡོན་གྱི་གུག་ཐིག།', 'Upper arch (stod phub): left curve down from the head.', [
      [30, 20],
      [26, 34],
      [28, 48],
    ]),
    step('ཉག་སྐེ། གཡས་ནས་ནང་དུ།', 'Notch neck (nyag ske): from right head, curve inward.', [
      [70, 20],
      [62, 32],
      [52, 42],
    ]),
    step('དབུས་ལག ཕྱིར་གུག།', 'Middle leg: turn outward to the right.', [
      [52, 42],
      [60, 50],
      [68, 48],
    ]),
    step('རྐེད་པ་དང་རྐང་པ། གཡས་ནས་གཡོན་མར།', 'Waist and foot: long tail sweeping down-left.', [
      [66, 50],
      [58, 62],
      [42, 76],
      [28, 88],
    ]),
  ]),

  // ཏ — head, left stem, right descending body
  c9: lesson('ta', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [28, 20],
      [72, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left stem down from the head.', [
      [38, 20],
      [38, 40],
      [36, 58],
    ]),
    step('རྐང་པ། གུག་སྟེ་མར།', 'Foot: descending body curve to the bottom.', [
      [38, 50],
      [44, 66],
      [52, 82],
      [48, 90],
    ]),
  ]),

  // ཐ — Fynn-style closed form with belly + right close
  c10: lesson('tha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('ཕུབ་ལག གཡོན་ནས་གུག།', 'Upper arch: left curve from the head.', [
      [28, 20],
      [24, 36],
      [30, 48],
    ]),
    step('རྐེད་ཐིག མར་འབབ།', 'Waist line: short drop from the arch.', [
      [30, 48],
      [32, 58],
    ]),
    step('སྒོ། འོག་གི་གུག་ཐིག།', 'Door/base: bottom curve left → right.', [
      [32, 58],
      [46, 66],
      [62, 64],
      [70, 56],
    ]),
    step('ཡར་འཐེན། གཡས་ནས་མར།', 'Pull-down: right stem closing the letter.', [
      [70, 20],
      [70, 40],
      [70, 58],
    ]),
  ]),

  // ད
  c11: lesson('da', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [26, 22],
      [74, 18],
    ]),
    step('དཔུང་པ་དང་རྐང་པ། གཡོན་ནས་གུག་སྟེ་མར་གཡས།', 'Shoulder to foot: main body curve down and right.', [
      [36, 20],
      [34, 40],
      [40, 62],
      [55, 78],
      [72, 88],
    ]),
  ]),

  // ན
  c12: lesson('na', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [24, 22],
      [76, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left stem.', [
      [34, 20],
      [34, 48],
    ]),
    step('སྐོ་དང་རྐང་པ། གུག་སྟེ་གཡས་མར།', 'Turn and foot: curve right then long descender.', [
      [34, 48],
      [48, 62],
      [62, 58],
      [70, 72],
      [74, 88],
    ]),
  ]),

  // པ — Fynn: head → left descender → bottom curve → right stem
  c13: lesson('pa', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [24, 22],
      [76, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder (dpung pa): left curve down.', [
      [32, 20],
      [30, 36],
      [32, 52],
    ]),
    step('སྒོ། འོག་གུག་གཡོན་ནས་གཡས།', 'Base curve: left → right under the body.', [
      [32, 52],
      [46, 62],
      [62, 60],
      [70, 52],
    ]),
    step('ཡར་འབུལ། གཡས་ནས་མར།', 'Right stem: top → bottom to the baseline.', [
      [70, 20],
      [72, 48],
      [74, 82],
    ]),
  ]),

  // ཕ
  c14: lesson('pha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left stem down.', [
      [30, 20],
      [28, 40],
      [30, 56],
    ]),
    step('སྒལ། གུག་ཐིག་གཡས།', 'Back: body curve to the right.', [
      [30, 40],
      [42, 48],
      [58, 50],
    ]),
    step('ནང་ཐིག སྣོན།', 'Inner mark: short interior stroke.', [
      [48, 32],
      [52, 44],
    ]),
    step('རྐང་པ། གཡས་ནས་མར།', 'Foot: right stem down.', [
      [72, 20],
      [74, 50],
      [76, 84],
    ]),
  ]),

  // བ
  c15: lesson('ba', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [20, 22],
      [80, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་གུག་སྟེ་མར།', 'Shoulder: left descending body.', [
      [30, 20],
      [28, 42],
      [36, 62],
      [52, 74],
    ]),
    step('རྐང་པ། གཡས་ནས་མར།', 'Foot: right long stem.', [
      [70, 20],
      [72, 48],
      [74, 86],
    ]),
  ]),

  // མ
  c16: lesson('ma', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [20, 22],
      [78, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left stem.', [
      [32, 20],
      [30, 44],
      [32, 60],
    ]),
    step('སྒོ། འོག་གུག།', 'Base: bottom belly curve.', [
      [32, 56],
      [46, 68],
      [60, 64],
      [68, 52],
    ]),
    step('དབུས་ལག ནང་ཐིག', 'Middle hand: inner stroke.', [
      [48, 28],
      [50, 46],
    ]),
    step('རྐང་པ། གཡས་ནས་མར།', 'Foot: right stem.', [
      [72, 20],
      [74, 50],
      [76, 84],
    ]),
  ]),

  // ཙ (ka-like body)
  c17: lesson('tsa', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('མཆེ་བ། གཡོན་གུག།', 'Tusk: left short curve.', [
      [32, 20],
      [30, 40],
      [32, 50],
    ]),
    step('དབུས་ལག', 'Middle leg down.', [
      [50, 20],
      [52, 58],
    ]),
    step('རྐང་པ། གཡས་ནས་མར།', 'Foot: long right stem.', [
      [68, 20],
      [72, 86],
    ]),
  ]),

  // ཚ
  c18: lesson('tsha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [20, 22],
      [80, 18],
    ]),
    step('ལག་པ་དང་སྒལ། གཟུགས་གཅིག་མར།', 'Arm and back: main body of tsha downward.', [
      [30, 20],
      [28, 48],
      [40, 62],
      [58, 58],
      [70, 36],
      [72, 20],
    ]),
  ]),

  // ཛ
  c19: lesson('dza', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left descending stroke.', [
      [30, 20],
      [28, 42],
      [34, 58],
    ]),
    step('སྒལ་དང་རྐང་པ།', 'Back and foot: body curve then long right leg.', [
      [34, 48],
      [48, 64],
      [62, 60],
      [70, 20],
      [74, 86],
    ]),
  ]),

  // ཝ
  c20: lesson('wa', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [26, 22],
      [74, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left stem.', [
      [34, 20],
      [32, 48],
    ]),
    step('དབུས་ལག', 'Middle stem.', [
      [50, 20],
      [50, 52],
    ]),
    step('སྒོ་དང་རྐང་པ། འཁོར་ཐིག་དང་གཡས།', 'Base loop and right foot.', [
      [34, 48],
      [42, 62],
      [54, 66],
      [66, 56],
      [70, 20],
      [72, 80],
    ]),
  ]),

  // ཞ
  c21: lesson('zha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [24, 22],
      [76, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར།', 'Shoulder: left stem.', [
      [34, 20],
      [32, 50],
    ]),
    step('སྒལ་དང་རྐང་པ།', 'Back and foot: curve then right descender.', [
      [34, 42],
      [48, 54],
      [62, 50],
      [70, 68],
      [74, 88],
    ]),
  ]),

  // ཟ
  c22: lesson('za', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('དཔུང་པ། གཡས་ནས་གཡོན་མར།', 'Shoulder: descending diagonal across the body.', [
      [70, 20],
      [55, 42],
      [32, 70],
    ]),
    step('སྒལ། འོག་ཐིག་གཡོན་ནས་གཡས།', 'Back: lower cross stroke.', [
      [30, 52],
      [50, 56],
      [72, 54],
    ]),
    step('རྐང་པ། གཡས་མར།', 'Foot: right tip down.', [
      [70, 56],
      [74, 78],
      [76, 90],
    ]),
  ]),

  // འ
  c23: lesson('achung', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [26, 22],
      [74, 18],
    ]),
    step('ལག་པ། གཡོན་ནས་མར།', 'Arm: left stem.', [
      [34, 20],
      [32, 58],
    ]),
    step('རྐང་པ། གཡས་ནས་མར།', 'Foot: right stem.', [
      [66, 20],
      [66, 58],
    ]),
    step('སྒོ། འོག་གུག་གཡོན་ནས་གཡས།', 'Base: bottom connecting curve.', [
      [32, 58],
      [48, 70],
      [66, 58],
    ]),
  ]),

  // ཡ — Fynn: combined head+arch → dbus lag → le gu → rtsa 'bab
  c24: lesson('ya', [
    step('ཚག་མགོ་དང་ཕུབ། མགོ་དང་གཡོན་གུག་གཅིག་ཏུ།', 'Head with left arch in one stroke (tshag mgo dang phub).', [
      [28, 22],
      [55, 18],
      [70, 20],
      [48, 20],
      [34, 34],
      [30, 52],
    ]),
    step('དབུས་ལག གཡས་ནས་གུག།', 'Middle leg (dbus lag): right inner curve down.', [
      [62, 20],
      [58, 36],
      [54, 54],
    ]),
    step('ལེ་གུ གཡས་མར།', 'Little tip (le gu): short diagonal down-right.', [
      [54, 54],
      [62, 66],
      [70, 74],
    ]),
    step('རྩ་འབབ། གཡས་ཐད་ཀར་མར།', 'Root drop (rtsa ’bab): right vertical to the bottom.', [
      [76, 20],
      [76, 48],
      [78, 82],
    ]),
  ]),

  // ར — head → neck → sweeping body
  c25: lesson('ra', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [24, 22],
      [76, 18],
    ]),
    step('སྐེ། དབུས་ནས་མར་གུག།', 'Neck (ske): short drop under the head.', [
      [48, 20],
      [46, 34],
      [44, 46],
    ]),
    step('སྦྲོག་དང་རྐེད་པ། གུག་ཆེན་གཡོན་ནས་གཡས་མར།', 'Join and waist: large crescent sweep to the bottom.', [
      [44, 46],
      [34, 58],
      [40, 72],
      [58, 82],
      [78, 88],
    ]),
  ]),

  // ལ
  c26: lesson('la', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('ལག་པ། གཡོན་ནས་མར།', 'Arm: left stem.', [
      [32, 20],
      [30, 56],
    ]),
    step('དབུས་ལག', 'Middle stem.', [
      [48, 20],
      [50, 56],
    ]),
    step('སྒོ། འོག་གུག།', 'Base curve connecting stems.', [
      [30, 56],
      [42, 68],
      [58, 66],
      [70, 52],
    ]),
    step('རྐང་པ། གཡས་ནས་མར།', 'Foot: right stem.', [
      [74, 20],
      [76, 50],
      [78, 84],
    ]),
  ]),

  // ཤ
  c27: lesson('sha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [24, 22],
      [76, 18],
    ]),
    step('སྟོད་ཕུབ། གཡོན་གུག།', 'Upper arch on the left.', [
      [34, 20],
      [30, 36],
      [36, 48],
    ]),
    step('དབུས་ལག', 'Middle body stroke.', [
      [48, 28],
      [50, 48],
    ]),
    step('སྒལ། གུག་ཐིག', 'Back curve.', [
      [36, 48],
      [48, 58],
      [62, 54],
    ]),
    step('རྐང་པ། གཡས་མར།', 'Foot: right descender.', [
      [68, 20],
      [72, 55],
      [74, 88],
    ]),
  ]),

  // ས — Fynn: མགོ → དཔུང་པ → ལེ་གུ → གཞུང་འབྲེད → ཡར་འཕུལ
  c28: lesson('sa', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་མར་གུག།', 'Shoulder (dpung pa): left curve down.', [
      [32, 20],
      [28, 36],
      [30, 52],
    ]),
    step('ལེ་གུ གཡོན་ནས་གཡས།', 'Little tip (le gu): lower left→right connector.', [
      [30, 52],
      [42, 60],
      [54, 58],
    ]),
    step('གཞུང་འབྲེད། དབུས་ནས་མར་གུག།', 'Body link (gzhung ’bred): middle descending curve.', [
      [52, 20],
      [54, 40],
      [60, 62],
      [66, 72],
    ]),
    step('ཡར་འཕུལ། གཡས་ནས་མར།', 'Final lift (yar ’phul): right stem top → bottom.', [
      [74, 20],
      [76, 50],
      [78, 86],
    ]),
  ]),

  // ཧ — Fynn: མགོ → དཔུང་པ → ལེག → སྨད་འབྲུལ
  c29: lesson('ha', [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [28, 22],
      [72, 18],
    ]),
    step('དཔུང་པ། གཡོན་ནས་གུག།', 'Shoulder: short left curve.', [
      [36, 20],
      [32, 32],
      [34, 42],
    ]),
    step('ལེག མར་གུག།', 'Limb: second curve down from the shoulder.', [
      [34, 36],
      [38, 48],
      [44, 56],
    ]),
    step('སྨད་འབྲུལ། གཡས་ནས་གུག་ཆེན་མར།', 'Lower hang: long right sweep down past the bottom guide.', [
      [64, 20],
      [72, 36],
      [70, 58],
      [58, 78],
      [48, 92],
    ]),
  ]),

  // ཨ — Fynn exception: left curve FIRST, then head
  c30: lesson('a', [
    step('ཐིག གཡོན་གྱི་གུག་ཐིག་སྔོན་ལ།', 'First mark: left C-curve (before the head on ཨ).', [
      [38, 24],
      [28, 40],
      [26, 58],
      [34, 74],
      [48, 80],
    ]),
    step(`${MGO} གཡོན་ནས་གཡས།`, 'Head (mgo): top bar left → right joining the left curve.', [
      [30, 22],
      [78, 18],
    ]),
    step('དཔྱང་བ། དབུས་ནས་མར།', 'Hanging stroke (dpyang ba): short mid drop from the head.', [
      [48, 20],
      [50, 36],
      [52, 46],
    ]),
    step('གཞུང་འབྲེད། གཡས་གུག་མར།', 'Body link: right outer descending curve.', [
      [64, 20],
      [72, 40],
      [74, 62],
      [68, 80],
    ]),
    step('ཡར་འཕུལ། གཡས་ཐད་ཀར་མར།', 'Final addition (yar ’phul): rightmost vertical.', [
      [78, 20],
      [80, 48],
      [80, 82],
    ]),
  ]),
}

const FYNN_SLUG = {
  c1: 'ka',
  c2: 'kha',
  c3: 'ga',
  c4: 'nga',
  c5: 'ca',
  c6: 'cha',
  c7: 'ja',
  c8: 'nya',
  c9: 'ta',
  c10: 'tha',
  c11: 'da',
  c12: 'na',
  c13: 'pa',
  c14: 'pha',
  c15: 'ba',
  c16: 'ma',
  c17: 'tsa',
  c18: 'tsha',
  c19: 'dza',
  c20: 'wa',
  c21: 'zha',
  c22: 'za',
  c23: 'achung',
  c24: 'ya',
  c25: 'ra',
  c26: 'la',
  c27: 'sha',
  c28: 'sa',
  c29: 'ha',
  c30: 'a',
}

export function getStrokeLesson(consonantId) {
  if (STROKE_LESSONS[consonantId]) return STROKE_LESSONS[consonantId]
  const slug = FYNN_SLUG[consonantId] || 'ka'
  return lesson(slug, [
    step(`${MGO} གཡོན་ནས་གཡས།`, MGO_EN, [
      [22, 22],
      [78, 18],
    ]),
    step('གཟུགས་མར་འབྲི།', 'Body stroke downward (Fynn: top→bottom, left→right).', [
      [36, 20],
      [40, 55],
      [60, 80],
    ]),
  ])
}

export const HAND_PHASES = ['watch', 'trace', 'practice']

/** Fynn-style staff line Y positions in the 0–100 lesson box. */
export const GUIDE_LINES = [18, 36, 54, 72, 90]
