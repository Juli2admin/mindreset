import { z } from 'zod';

export const AnswerSchema = z.object({
  exclusion: z.record(z.string(), z.boolean()),
  functionality: z.record(z.string(), z.number().int().min(0).max(5)),
  emotional: z.record(z.string(), z.number().int().min(0).max(5)),
  trauma: z.number().int().min(0).max(3).nullable(),
  cognitive: z.record(z.string(), z.enum(['yes', 'no'])),
  consent: z.record(z.string(), z.boolean()),
});

export type AnswerShape = z.infer<typeof AnswerSchema>;

export type ClassifierResult = {
  result: 'green' | 'yellow' | 'red';
  reasonSummary: string;
  classifierVer: string;
};

const CLASSIFIER_VERSION = 'v1';

export function classify(answers: AnswerShape): ClassifierResult {
  if (Object.values(answers.exclusion).some(Boolean)) {
    return {
      result: 'red',
      reasonSummary: 'Exclusion criterion present',
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  if (answers.trauma === 2 || answers.trauma === 3) {
    return {
      result: 'red',
      reasonSummary: `Trauma level ${answers.trauma} of 3`,
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  if (Object.values(answers.functionality).some((v) => v <= 1)) {
    return {
      result: 'red',
      reasonSummary: 'Functionality score <=1 on at least one item',
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  if (Object.values(answers.consent).some((v) => !v)) {
    return {
      result: 'yellow',
      reasonSummary: 'Consent missing',
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  if (Object.values(answers.cognitive).some((v) => v === 'no')) {
    return {
      result: 'yellow',
      reasonSummary: 'Cognitive flag',
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  if (Object.values(answers.emotional).filter((v) => v >= 4).length >= 3) {
    return {
      result: 'yellow',
      reasonSummary: 'Multiple high-intensity emotional flags',
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  const fnVals = Object.values(answers.functionality);
  if (fnVals.filter((v) => v <= 3).length > fnVals.length / 2) {
    return {
      result: 'yellow',
      reasonSummary: 'More than half of functionality below threshold',
      classifierVer: CLASSIFIER_VERSION,
    };
  }

  return {
    result: 'green',
    reasonSummary: 'All clear',
    classifierVer: CLASSIFIER_VERSION,
  };
}
