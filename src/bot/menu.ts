import { InlineKeyboard, Keyboard } from "grammy";
import { Commands } from "./commands";

export const SendPhoneMenu = new Keyboard()
  .requestContact("Отправить контакт")
  .resized();

export const AdminMenu = new Keyboard()
  .text(Commands.Events)
  .text(Commands.Users)
  .row()
  .text(Commands.HomeWorks)
  .resized();

export const EventsAdminMenu = () =>
  new InlineKeyboard().text(Commands.CreateEvent, Commands.CreateEvent);

export const MakePayersMenu = new InlineKeyboard()
  .text(Commands.MakePayers, Commands.MakePayers)
  .row()
  .text(Commands.DeletePayers, Commands.DeletePayers);

export const UserMenu = new Keyboard()
  .text(Commands.Events)
  .text(Commands.RegisteredEvents)
  .row()
  .text(Commands.HomeWorks)
  .resized();

export const HomeWorkTypeMenu = (id: number) =>
  new InlineKeyboard()
    .text(Commands.LinkTypeHomeWork, `${Commands.LinkTypeHomeWork}:${id}`)
    .row()
    .text(Commands.FileTypeHomeWork, `${Commands.FileTypeHomeWork}:${id}`);
