import { InlineKeyboard, Keyboard } from "grammy";
import { Commands } from "./commands";

export const SendPhoneMenu = new Keyboard()
  .requestContact("Отправить контакт")
  .resized();

export const AdminMenu = new Keyboard().text(Commands.Events).resized();

export const EventsAdminMenu = () =>
  new InlineKeyboard().text(Commands.CreateEvent, Commands.CreateEvent);

export const UserMenu = new Keyboard()
  .text(Commands.Events)
  .text(Commands.RegisteredEvents)
  .resized();
