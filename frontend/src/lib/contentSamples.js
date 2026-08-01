/** Shared UI sample strings from ``content/ui_samples.yaml``. */
import { parse } from 'yaml'
import raw from '@content/ui_samples.yaml?raw'

const data = parse(raw) || {}

export const grammarSamples = Array.isArray(data.grammar_samples) ? data.grammar_samples : []
