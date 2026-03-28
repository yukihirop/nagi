import { z } from "zod/v4";

export const AdditionalMountSchema = z.object({
  hostPath: z.string(),
  containerPath: z.string().optional(),
  readonly: z.boolean().optional(),
});

export type AdditionalMount = z.infer<typeof AdditionalMountSchema>;

export const ContainerConfigSchema = z.object({
  additionalMounts: z.array(AdditionalMountSchema).optional(),
  timeout: z.number().optional(),
});

export type ContainerConfig = z.infer<typeof ContainerConfigSchema>;

export const RegisteredGroupSchema = z.object({
  name: z.string(),
  folder: z.string(),
  trigger: z.string(),
  added_at: z.string(),
  containerConfig: ContainerConfigSchema.optional(),
  requiresTrigger: z.boolean().optional(),
  isMain: z.boolean().optional(),
});

export type RegisteredGroup = z.infer<typeof RegisteredGroupSchema>;

export const AllowedRootSchema = z.object({
  path: z.string(),
  allowReadWrite: z.boolean(),
  description: z.string().optional(),
});

export type AllowedRoot = z.infer<typeof AllowedRootSchema>;

export const MountAllowlistSchema = z.object({
  allowedRoots: z.array(AllowedRootSchema),
  blockedPatterns: z.array(z.string()),
  nonMainReadOnly: z.boolean(),
});

export type MountAllowlist = z.infer<typeof MountAllowlistSchema>;
