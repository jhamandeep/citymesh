import { networkLinks } from './private-network.ts';
import type { Project } from './site-model.ts';
import { losProfile, type Environment } from './environment-model.ts';
export type MicrowaveAssessment = {
  frequencyGHz: number;
  links: {
    id: string;
    status: string;
    clearance: number | null;
    fresnelClearance: number | null;
    excluded: boolean;
  }[];
};
export function assessMicrowave(
  env: Environment,
  portfolio: Record<string, Project>,
  frequencyGHz: number,
): MicrowaveAssessment {
  return {
    frequencyGHz,
    links: networkLinks
      .filter((l) => l.kind === 'microwave')
      .map((link) => {
        try {
          const p = losProfile(env, link, portfolio, frequencyGHz);
          return {
            id: link.id,
            status: p.status,
            clearance: p.clearance,
            fresnelClearance: p.fresnelClearance,
            excluded: p.status !== 'Model clear',
          };
        } catch {
          return {
            id: link.id,
            status: 'Unverified endpoints or terrain',
            clearance: null,
            fresnelClearance: null,
            excluded: true,
          };
        }
      }),
  };
}
export function microwaveExclusions(
  assessment: MicrowaveAssessment | null,
  enabled: boolean,
) {
  return enabled && assessment
    ? assessment.links.filter((l) => l.excluded).map((l) => l.id)
    : [];
}
