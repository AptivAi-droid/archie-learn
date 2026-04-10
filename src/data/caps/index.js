import { mathematics } from './mathematics'
import { physicalSciences } from './physicalSciences'
import { lifeSciences } from './lifeSciences'
import { englishHomeLanguage } from './englishHomeLanguage'
import { history } from './history'

export const CAPS_CONTENT = {
  'Mathematics': mathematics,
  'Physical Sciences': physicalSciences,
  'Life Sciences': lifeSciences,
  'English Home Language': englishHomeLanguage,
  'History': history,
}

export function getTopics(subject, grade) {
  return CAPS_CONTENT[subject]?.[grade] || []
}
