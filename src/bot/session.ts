import { Context, SessionFlavor } from "grammy";
import { RegistrationSteps } from "../utils";

export type SessionData = {
  registrationStep?: RegistrationSteps;
};

export type BotContext = Context & SessionFlavor<SessionData>;
