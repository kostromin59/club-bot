import {
  Bot,
  GrammyError,
  HttpError,
  InlineKeyboard,
  InputFile,
  session,
} from "grammy";
import {
  Config,
  CreateEventSteps,
  RegistrationSteps,
  getEventsMessage,
  getUserRegisteredEventsMessage,
  isValidPhoneNumber,
} from "./utils";
import {
  AdminMenu,
  BotContext,
  Commands,
  SendPhoneMenu,
  UserMenu,
} from "./bot";
import { prisma } from "./utils/prisma";
import xlsx from "xlsx";
import { Readable } from "node:stream";

const config = new Config();

const bot = new Bot<BotContext>(config.token);

bot.api.setMyCommands([
  { command: "id", description: "Узнать свой ID" },
  { command: "start", description: "Начать работу бота" },
]);

bot.command("id", (ctx) => {
  if (!ctx.from?.id) return;
  ctx.reply(ctx.from.id.toString());
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

bot.use(session({ initial: () => ({ createEvent: {} }) }));

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

adminBot.hears(Commands.Events, async (ctx) => {
  const { message, keyboard } = await getEventsMessage(1, true);

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
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

  const message = `<b>${event.name}</b> (id: ${event.id})\n${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(event.dateStart)}\nМесто: ${event.place}\nКол-во участников: ${event.usersCount}\n\nВыберите действие`;

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });

  await ctx.answerCallbackQuery("Выберите действие");
});

// Удалить мероприятие
adminBot.use(async (ctx, next) => {
  if (!ctx.callbackQuery?.data?.startsWith(Commands.DeleteEvent)) return next();

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

      ctx.session.createEvent.step = CreateEventSteps.DateStart;
      await ctx.reply(
        "Введите дату начала в формате год-месяц-деньTчасы-минуты-секундыZ\nПример: 2024-06-10T12:00:00Z",
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
    ["ФИО", "Номер телефона", "Telegram username"],
    ...event.UserEvent.map(({ user }) => [user.fio, user.phone, user.nickname]),
  ]);

  xlsx.utils.book_append_sheet(workbook, worksheet);
  const buffer = xlsx.write(workbook, { type: "buffer" });
  const stream = Readable.from(buffer);

  await ctx.replyWithDocument(new InputFile(stream, `${event.name}.xlsx`));
  await ctx.answerCallbackQuery("Вам будет отправлен файл");
});

const userBot = bot.filter((ctx) => {
  const id = ctx.from?.id;
  if (!id) return false;

  const isUser = !config.admins.includes(id);
  return isUser;
});

// Установка пользователя в сессию
userBot.use(async (ctx, next) => {
  const id = ctx.from?.id;
  const nickname = ctx.from?.username;
  if (!id || !nickname) return;

  const user = await prisma.user.findFirst({ where: { id } });

  if (!user) {
    const user = await prisma.user.create({
      data: {
        id,
        nickname,
      },
    });

    ctx.session.user = user;
  } else {
    ctx.session.user = user;
  }

  next();
});

// Регистрация пользователя (обработка шагов)
userBot.use(async (ctx, next) => {
  const user = ctx.session.user;
  if (!user) return;

  const step = ctx.session.registrationStep;
  if (!step) return next();

  const message = ctx.message;
  if (!message) return;

  const contact = message.contact?.phone_number;

  const phoneData = {
    phone: contact,
  };

  switch (step) {
    case RegistrationSteps.Fio:
      ctx.session.user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          fio: message.text,
        },
      });

      if (ctx.session.user.phone) return next();

      ctx.session.registrationStep = RegistrationSteps.Phone;
      await ctx.reply("Введите номер телефона в формате +79123456789", {
        reply_markup: SendPhoneMenu,
      });

      break;
    case RegistrationSteps.Phone:
      if (user.phone) {
        ctx.session.registrationStep = undefined;
        break;
      }

      if (!contact) {
        if (!isValidPhoneNumber(message.text))
          return await ctx.reply(
            "Вы некорректно ввели телефон. Попробуйте ещё раз!",
            {
              reply_markup: SendPhoneMenu,
            },
          );

        phoneData.phone = message.text!;
      }

      ctx.session.user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: phoneData,
      });

      ctx.session.registrationStep = undefined;
      await ctx.reply("Регистрация окончена!", {
        reply_markup: UserMenu,
      });
      break;
  }
});

// Валидация пользователя
userBot.use(async (ctx, next) => {
  const user = ctx.session.user;
  if (!user) return;

  if (!user.fio) {
    ctx.session.registrationStep = RegistrationSteps.Fio;
    await ctx.reply("Введите ФИО");
    return;
  }

  if (!user.phone) {
    ctx.session.registrationStep = RegistrationSteps.Phone;
    await ctx.reply("Введите номер телефона в формате +79123456789", {
      reply_markup: SendPhoneMenu,
    });
    return;
  }

  return next();
});

userBot.command("start", async (ctx) => {
  await ctx.reply("Добро пожаловать!", {
    reply_markup: UserMenu,
  });
});

// Отправить мероприятия
userBot.hears(Commands.Events, async (ctx) => {
  const { message, keyboard } = await getEventsMessage();

  await ctx.reply(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
});

// Изменить страницу
userBot.use(async (ctx, next) => {
  if (!ctx.callbackQuery?.data?.startsWith(Commands.EventsSetPage))
    return next();

  const page = parseInt(ctx.callbackQuery.data.split(":")[1]);
  if (!page) return;

  const { message, keyboard } = await getEventsMessage(page);

  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// Записаться на мероприятие
userBot.use(async (ctx, next) => {
  if (!ctx.callbackQuery?.data?.startsWith(Commands.RegisterToEvent))
    return next();

  const eventId = parseInt(ctx.callbackQuery.data.split(":")[1]);
  if (!eventId) return;

  const user = ctx.session.user;
  if (!user) return;

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
    },
    select: {
      usersCount: true,
      _count: true,
      UserEvent: true,
    },
  });

  if (!event) return;

  if (event.UserEvent.some(({ userId }) => userId === user.id))
    return await ctx.answerCallbackQuery("Вы уже записаны!");

  if (
    !event.usersCount ||
    event.usersCount === 0 ||
    event._count.UserEvent < event.usersCount
  ) {
    await prisma.userEvent.create({
      data: {
        userId: user.id,
        eventId,
      },
    });
    await ctx.answerCallbackQuery("Вы успешно записаны!");
  }
});

// Отписаться от мероприятия
userBot.use(async (ctx, next) => {
  if (!ctx.callbackQuery?.data?.startsWith(Commands.DeleteRegistrationToEvent))
    return next();

  const eventId = parseInt(ctx.callbackQuery.data.split(":")[1]);
  if (!eventId) return;

  const user = ctx.session.user;
  if (!user) return;

  await prisma.userEvent.deleteMany({
    where: {
      userId: user.id,
      eventId,
    },
  });

  const { message, keyboard } = await getUserRegisteredEventsMessage(user.id);
  await ctx.editMessageText(message, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
  await ctx.answerCallbackQuery("Успешно!");
});

// Посмотреть записи
userBot.hears(Commands.RegisteredEvents, async (ctx) => {
  const user = ctx.session.user;
  if (!user) return;

  const { message, keyboard } = await getUserRegisteredEventsMessage(user.id);

  await ctx.reply(message, { reply_markup: keyboard, parse_mode: "HTML" });
});

bot.start();
