import { Context, SessionFlavor } from "grammy";
import { CreateEventSteps, PayersSteps, RegistrationSteps } from "../utils";
import type { User, Prisma } from "@prisma/client";

export type SessionData = {
  registrationStep?: RegistrationSteps;
  user?: User;
  createEvent: {
    step?: CreateEventSteps;
    data?: Prisma.EventCreateInput;
  };
  payersStep?: PayersSteps;
};

export type BotContext = Context & SessionFlavor<SessionData>;
