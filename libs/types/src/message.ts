import { z } from "zod/v4";

export const NewMessageSchema = z.object({
  id: z.string(),
  chat_jid: z.string(),
  sender: z.string(),
  sender_name: z.string(),
  content: z.string(),
  timestamp: z.string(),
  is_from_me: z.boolean().optional(),
  is_bot_message: z.boolean().optional(),
});

export type NewMessage = z.infer<typeof NewMessageSchema>;
