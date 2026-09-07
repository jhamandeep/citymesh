import { flushSync } from 'react-dom';
import { scenarios, simulate } from './simulation';
type Context = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerSimulationTool(
  apply: (scenario: string, demand: number) => void,
) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tool = {
    name: 'configure_city_simulation',
    description:
      'Apply a city disruption and traffic demand, clearing manual asset failures, and return the resulting connectivity metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: { type: 'string', enum: scenarios.map((s) => s.id) },
        demand: { type: 'number', minimum: 25, maximum: 250 },
      },
      required: ['scenario', 'demand'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input: unknown) {
      const p = input as { scenario?: unknown; demand?: unknown };
      if (
        !p ||
        typeof p.scenario !== 'string' ||
        !scenarios.some((s) => s.id === p.scenario) ||
        typeof p.demand !== 'number' ||
        !Number.isFinite(p.demand) ||
        p.demand < 25 ||
        p.demand > 250
      )
        throw new Error(
          'Choose a valid scenario and a demand between 25 and 250.',
        );
      const scenario = p.scenario,
        demand = p.demand;
      flushSync(() => apply(scenario, demand));
      const r = simulate(scenario, demand);
      return {
        scenario,
        demand,
        availability: r.availability,
        deliveredMbps: r.delivered,
        affectedAssets: r.states
          .filter((a) => a.status !== 'online')
          .map((a) => a.name),
      };
    },
  };
  try {
    Promise.resolve(
      context.registerTool(tool, { signal: lifecycle.signal }),
    ).catch(() => {});
  } catch {}
  return () => lifecycle.abort();
}
