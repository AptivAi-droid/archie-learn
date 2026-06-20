import { mathematics } from './mathematics'
import { physicalSciences } from './physicalSciences'
import { lifeSciences } from './lifeSciences'
import { englishHomeLanguage } from './englishHomeLanguage'
import { history } from './history'
import { mathematicalLiteracy } from './mathematicalLiteracy'
import { accounting } from './accounting'

export const CAPS_CONTENT = {
  'Mathematics': mathematics,
  'Mathematical Literacy': mathematicalLiteracy,
  'Physical Sciences': physicalSciences,
  'Life Sciences': lifeSciences,
  'English Home Language': englishHomeLanguage,
  'History': history,
  'Accounting': accounting,
}

export function getTopics(subject, grade) {
  return CAPS_CONTENT[subject]?.[grade] || []
}
