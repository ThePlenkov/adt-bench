import { z } from 'zod';

export const AgentPrepareInputSchema = z
  .object({
    workspaceDir: z.string().min(1),
    agentConfigDir: z.string().min(1),
    skillsDir: z.string().min(1),
    mcpConfigPath: z.string().min(1),
    instructionsPath: z.string().optional(),
  })
  .strict();
export type AgentPrepareInput = z.infer<typeof AgentPrepareInputSchema>;

export const AgentRunInputSchema = z
  .object({
    runId: z.string().min(1),
    scenarioId: z.string().min(1),
    prompt: z.string().min(1),
    timeoutMs: z.number().int().positive(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;

export interface AgentRunner {
  readonly id: string;
  prepare(input: AgentPrepareInput): Promise<void>;
  run(input: AgentRunInput): Promise<import('./result.js').AgentRunResult>;
}
