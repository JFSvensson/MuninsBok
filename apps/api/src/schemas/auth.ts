import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  name: z.string().min(1, "Namn krävs").max(200),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken").max(128, "Lösenordet får vara max 128 tecken"),
});

export const loginSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(1, "Lösenord krävs"),
});
