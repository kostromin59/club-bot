import { Context, SessionFlavor } from "grammy";
import { CreateEventSteps, RegistrationSteps } from "../utils";
import type { User, Prisma } from "@prisma/client";

export type SessionData = {
  registrationStep?: RegistrationSteps;
  user?: User;
  createEvent: {
    step?: CreateEventSteps;
    data?: Prisma.EventCreateInput;
  };
};

export type BotContext = Context & SessionFlavor<SessionData>;
