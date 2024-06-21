import { Context, SessionFlavor } from "grammy";
import {
  CreateEventSteps,
  CreateHomeworkSteps,
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
  createHomework: {
    step?: CreateHomeworkSteps;
    data?: Prisma.HomeworkCreateInput;
  };
  payersStep?: PayersSteps;
  answerHomework?: number;
};

export type BotContext = Context & SessionFlavor<SessionData>;