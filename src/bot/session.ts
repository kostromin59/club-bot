import { Context, SessionFlavor } from "grammy";
import {
  CreateEventSteps,
  CreateHomeWorkSteps,
  PayersSteps,
  RegistrationSteps,
} from "../utils";
import type { User, Prisma } from "@prisma/client";

export type SessionData = {
  registrationStep?: RegistrationSteps;
  user?: User;
  createEvent: {
    step?: CreateEventSteps;
    data?: Prisma.EventCreateInput;
  };
  createHomeWork: {
    step?: CreateHomeWorkSteps;
    data?: Prisma.HomeWorkCreateInput;
  };
  payersStep?: PayersSteps;
  answerHomeWork?: number;
};

export type BotContext = Context & SessionFlavor<SessionData>;
