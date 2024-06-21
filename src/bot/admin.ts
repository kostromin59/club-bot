import { Api, Bot, InlineKeyboard, InputFile, RawApi } from "grammy";
import { BotContext } from "./session";
import {
  Config,
  CreateEventSteps,
  CreateHomeworkSteps,
  PayersSteps,
  getEventsMessage,
  prisma,
} from "../utils";
import { Commands } from "./commands";
import { AdminMenu, HomeworkTypeMenu, MakePayersMenu } from "./menu";
import xlsx from "xlsx";
import { Readable } from "node:stream";
import { getHomeworksMessage } from "../utils/messages/homeworks";

export const buildAdminBot = (
  bot: Bot<BotContext, Api<RawApi>>,
  config: Config,
) => {
  const adminBot = bot.filter((ctx) => {
    const id = ctx.from?.id;
    if (!id) return false;

    const isAdmin = config.admins.includes(id);
    return isAdmin;
  });

  adminBot.command("start", (ctx) => {
    ctx.reply("Добро пожаловать!", {
      reply_markup: AdminMenu,
    });
  });

  // Домашние задания
  adminBot.hears(Commands.Homeworks, async (ctx) => {
    const { message, keyboard } = await getHomeworksMessage(1, true);
    await ctx.reply(message, { reply_markup: keyboard, parse_mode: "HTML" });
  });

  // Создание ДЗ
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.CreateHomework))
      return next();

    ctx.session.createHomework.step = CreateHomeworkSteps.File;
    await ctx.answerCallbackQuery("Начало создания ДЗ");
    await ctx.reply("Прикрепите файл или напишите текст");
  });

  adminBot.use(async (ctx, next) => {
    if (ctx.session.createHomework.step !== CreateHomeworkSteps.File) return next();

    const message = ctx.message?.text;
    if (!message) return;

    ctx.session.createHomework.data = {
      answerEndDate: "",
      text: message,
    };

    ctx.session.createHomework.step = CreateHomeworkSteps.AnswerEndDate;
    await ctx.reply(
      "Введите дату окончания приёма ответов в формате год-месяц-деньTчасы:минуты:секундыZ\nПример: 2024-06-10T12:00:00Z",
    );
  })

  // Управление ДЗ
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.HomeworksManage))
      return next();

    const id = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!id) return;

    const homework = await prisma.homework.findFirst({
      where: { id },
    });

    if (!homework) return await ctx.answerCallbackQuery("Не найдено");

    if (homework.text) {
      await ctx.reply(`${homework.text}\n\nВыберите тип:`, { reply_markup: HomeworkTypeMenu(id) });
    } else if (homework.filePath) {
      await ctx.replyWithDocument(homework.filePath, { reply_markup: HomeworkTypeMenu(id) })
    }

    await ctx.answerCallbackQuery("Выберите тип");
  });

  // Удаление ДЗ
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.DeleteHomework))
      return next();

    const id = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!id) return;

    const homework = await prisma.homework.findFirst({
      where: { id },
    });

    if (!homework) return await ctx.answerCallbackQuery("Не найдено");

    await prisma.homework.delete({
      where: {
        id
      }
    });

    await ctx.deleteMessage();
    await ctx.answerCallbackQuery("Удалено");
  });

  // Только ссылки
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.LinkTypeHomework))
      return next();

    const id = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!id) return;

    const homework = await prisma.homework.findFirst({
      where: { id },
      include: {
        HomeworkAnswer: {
          where: { link: { not: null } },
          include: {
            user: true,
          },
        },
      },
    });

    if (!homework) return await ctx.answerCallbackQuery("Не найдено");

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      ["ФИО", "Номер телефона", "Telegram username", "Ссылка"],
      ...homework.HomeworkAnswer.map(({ user, link }) => [
        user.fio,
        user.phone,
        `https://t.me/${user.nickname}?text=${encodeURIComponent(`#${homework.id} Homework ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(homework.createdAt)}`)}.\n\n`,
        link,
      ]),
    ]);

    xlsx.utils.book_append_sheet(workbook, worksheet);
    const buffer = xlsx.write(workbook, { type: "buffer" });
    const stream = Readable.from(buffer);

    await ctx.replyWithDocument(
      new InputFile(
        stream,
        `(#${homework.id}) Ссылки ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(homework.createdAt)}.xlsx`,
      ),
    );
    await ctx.answerCallbackQuery("Файл отправлен");
  });

  // Только файлы
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.FileTypeHomework))
      return next();

    const id = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!id) return;

    const homework = await prisma.homework.findFirst({
      where: { id },
      include: {
        HomeworkAnswer: {
          where: { filePath: { not: null } },
          include: {
            user: true,
          },
        },
      },
    });

    if (!homework) return await ctx.answerCallbackQuery("Не найдено");

    const answers: [string, string, string, string][] = [];

    for await (const answer of homework.HomeworkAnswer) {
      if (!answer.filePath || !answer.user.fio) continue;

      const file = await ctx.api.getFile(answer.filePath);

      answers.push([
        answer.user.fio,
        answer.user.phone || "",
        `https://t.me/${answer.user.nickname}?text=${encodeURIComponent(`#${homework.id} Homework ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(homework.createdAt)}`)}.\n\n`,
        `https://api.telegram.org/file/bot${config.token}/${file.file_path}`,
      ]);
    }

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      ["ФИО", "Номер телефона", "Telegram username", "Ссылка на файл"],
      ...answers,
    ]);

    xlsx.utils.book_append_sheet(workbook, worksheet);
    const buffer = xlsx.write(workbook, { type: "buffer" });
    const stream = Readable.from(buffer);

    await ctx.replyWithDocument(
      new InputFile(
        stream,
        `(#${homework.id}) Файлы ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(homework.createdAt)}.xlsx`,
      ),
    );
    await ctx.answerCallbackQuery("Файл отправлен");
  });

  // Файл
  adminBot.on(":file", async (ctx) => {
    if (ctx.session.createHomework.step !== CreateHomeworkSteps.File) return;
    const file = await ctx.getFile();
    const filePath = file.file_id;

    ctx.session.createHomework.data = {
      filePath,
      answerEndDate: "",
    };
    ctx.session.createHomework.step = CreateHomeworkSteps.AnswerEndDate;
    await ctx.reply(
      "Введите дату окончания приёма ответов в формате год-месяц-деньTчасы:минуты:секундыZ\nПример: 2024-06-10T12:00:00Z",
    );
  });

  adminBot.use(async (ctx, next) => {
    if (ctx.session.createHomework.step !== CreateHomeworkSteps.AnswerEndDate)
      return next();

    const message = ctx.message?.text;
    if (!message) return;

    ctx.session.createHomework.data!.answerEndDate = message;
    ctx.session.createHomework.step = undefined;

    await prisma.homework.create({
      data: ctx.session.createHomework.data!,
    });

    await ctx.reply("Создано!");
  });

  adminBot.hears(Commands.Events, async (ctx) => {
    const { message, keyboard } = await getEventsMessage(1, true);

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  });

  // Изменить страницу для ДЗ
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.HomeworksSetPage))
      return next();

    const page = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!page) return;

    const { message, keyboard } = await getHomeworksMessage(page, true);

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // Изменить страницу
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.EventsSetPage))
      return next();

    const page = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!page) return;

    const { message, keyboard } = await getEventsMessage(page, true);

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  });

  // Управлять мероприятием
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.EventsManage))
      return next();

    const eventId = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!eventId) return;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
      },
    });

    if (!event) return;

    const keyboard = new InlineKeyboard()
      .text("Удалить", `${Commands.DeleteEvent}:${eventId}`)
      .row()
      .text("Показать участников", `${Commands.ShowUsersOnEvent}:${eventId}`);

    const message = `<b>${event.name}</b> (id: ${event.id})\n${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(event.dateStart)}\nМесто: ${event.place}\nКол-во участников: ${event.usersCount}\nКол-во платных участников: ${event.payersCount}\n\nВыберите действие`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await ctx.answerCallbackQuery("Выберите действие");
  });

  // Удалить мероприятие
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.DeleteEvent))
      return next();

    const eventId = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!eventId) return;

    await prisma.event.delete({ where: { id: eventId } });
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery("Удалено");
  });

  // Нажатие на кнопку "Создать мероприятие"
  adminBot.callbackQuery(Commands.CreateEvent, async (ctx) => {
    ctx.session.createEvent.step = CreateEventSteps.Name;
    await ctx.answerCallbackQuery("Начало создания мероприятия");
    await ctx.reply("Введите название мероприятия");
  });

  // Создание мероприятий
  adminBot.use(async (ctx, next) => {
    const step = ctx.session.createEvent.step;
    if (!step) return next();

    const message = ctx.message?.text;
    if (!message) return;

    switch (step) {
      case CreateEventSteps.Name:
        ctx.session.createEvent.data = {
          name: message,
          place: "",
          dateStart: "",
        };

        ctx.session.createEvent.step = CreateEventSteps.UsersCount;
        await ctx.reply("Введите количество участников");
        return;
      case CreateEventSteps.UsersCount:
        ctx.session.createEvent.data!.usersCount = Number.parseInt(message);

        ctx.session.createEvent.step = CreateEventSteps.PayersCount;
        await ctx.reply("Введите количество платных участников");
        return;
      case CreateEventSteps.PayersCount:
        ctx.session.createEvent.data!.payersCount = Number.parseInt(message);

        ctx.session.createEvent.step = CreateEventSteps.DateStart;
        await ctx.reply(
          "Введите дату начала в формате год-месяц-деньTчасы:минуты:секундыZ\nПример: 2024-06-10T12:00:00Z",
        );
        return;
      case CreateEventSteps.DateStart:
        ctx.session.createEvent.data!.dateStart = message;

        ctx.session.createEvent.step = CreateEventSteps.Place;
        await ctx.reply("Введите место проведения");
        return;
      case CreateEventSteps.Place:
        ctx.session.createEvent.data!.place = message;

        await prisma.event.create({
          data: ctx.session.createEvent.data!,
        });

        ctx.session.createEvent = {};

        await ctx.reply("Мероприятие создано!");
        return;
    }
  });

  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.ShowUsersOnEvent))
      return next();

    const eventId = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!eventId) return;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
      },
      include: {
        UserEvent: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!event) return;

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      [event.name],
      ["ФИО", "Номер телефона", "Telegram username", "Платник"],
      ...event.UserEvent.map(({ user }) => [
        user.fio,
        user.phone,
        user.nickname,
        user.isPayer ? "Да" : "Нет",
      ]),
    ]);

    xlsx.utils.book_append_sheet(workbook, worksheet);
    const buffer = xlsx.write(workbook, { type: "buffer" });
    const stream = Readable.from(buffer);

    await ctx.replyWithDocument(new InputFile(stream, `${event.name}.xlsx`));
    await ctx.answerCallbackQuery("Вам будет отправлен файл");
  });

  adminBot.hears(Commands.Users, async (ctx) => {
    const users = await prisma.user.findMany({
      orderBy: {
        fio: "asc",
      },
    });

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      ["ID", "ФИО", "Номер телефона", "Telegram username", "Платник"],
      ...users.map((user) => [
        user.id,
        user.fio,
        user.phone,
        user.nickname,
        user.isPayer ? "Да" : "Нет",
      ]),
    ]);

    xlsx.utils.book_append_sheet(workbook, worksheet);
    const buffer = xlsx.write(workbook, { type: "buffer" });
    const stream = Readable.from(buffer);

    await ctx.replyWithDocument(new InputFile(stream, "Пользователи.xlsx"), {
      reply_markup: MakePayersMenu,
    });
  });

  // Добавить платников
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.MakePayers))
      return next();

    ctx.session.payersStep = PayersSteps.MakePayers;
    await ctx.reply("Укажите через запятую ID пользователей");
    await ctx.answerCallbackQuery("Укажите через запятую ID пользователей");
  });

  // Удалить платников
  adminBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.DeletePayers))
      return next();

    ctx.session.payersStep = PayersSteps.DeletePayers;
    await ctx.reply("Укажите через запятую ID пользователей");
    await ctx.answerCallbackQuery("Укажите через запятую ID пользователей");
  });

  // Сделать или убрать платников
  adminBot.use(async (ctx, next) => {
    if (!ctx.session.payersStep) return next();

    const message = ctx.message?.text;
    if (!message) return;

    const userIds = message
      .split(",")
      .map((uid) => uid.trim())
      .map(parseInt)
      .filter((n) => !isNaN(n));

    await prisma.user.updateMany({
      where: {
        id: {
          in: userIds,
        },
      },
      data: {
        isPayer: ctx.session.payersStep === PayersSteps.MakePayers,
      },
    });

    ctx.session.payersStep = undefined;
    await ctx.reply("Обновлено!");
  });
};
