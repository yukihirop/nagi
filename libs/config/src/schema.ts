import { z } from "zod/v4";

export const NagiConfigSchema = z.object({
  assistantName: z.string().default("Andy"),
  assistantHasOwnNumber: z.boolean().default(false),
  timezone: z.string().default(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ),
  container: z
    .object({
      image: z.string().default("nagi-agent:latest"),
      timeout: z.number().min(1000).default(1800000),
      maxOutputSize: z.number().min(1024).default(10485760),
      idleTimeout: z.number().min(0).default(1800000),
      maxConcurrent: z.number().min(1).default(5),
      credentialProxyPort: z.number().min(1024).max(65535).default(3001),
    })
    .default({
      image: "nagi-agent:latest",
      timeout: 1800000,
      maxOutputSize: 10485760,
      idleTimeout: 1800000,
      maxConcurrent: 5,
      credentialProxyPort: 3001,
    }),
  intervals: z
    .object({
      poll: z.number().default(2000),
      schedulerPoll: z.number().default(60000),
      ipcPoll: z.number().default(1000),
    })
    .default({
      poll: 2000,
      schedulerPoll: 60000,
      ipcPoll: 1000,
    }),
  paths: z.object({
    storeDir: z.string(),
    groupsDir: z.string(),
    dataDir: z.string(),
    mountAllowlistPath: z.string(),
    senderAllowlistPath: z.string(),
  }),
});

export type NagiConfig = z.infer<typeof NagiConfigSchema>;
