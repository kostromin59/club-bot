import { Context, SessionFlavor } from "grammy";
import { RegistrationSteps } from "../utils";
import type { User } from "@prisma/client";

export type SessionData = {
  registrationStep?: RegistrationSteps;
  user?: User;
};

export type BotContext = Context & SessionFlavor<SessionData>;
