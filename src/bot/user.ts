import { Api, Bot, InlineKeyboard, RawApi } from "grammy";
import { BotContext } from "./session";
import {
  Config,
  RegistrationSteps,
  getEventsMessage,
  getUserRegisteredEventsMessage,
  isValidPhoneNumber,
  prisma,
} from "../utils";
import { SendPhoneMenu, UserMenu } from "./menu";
import { Commands } from "./commands";
import { getHomeworksMessage } from "../utils/messages/homeworks";

export const buildUserBot = (
  bot: Bot<BotContext, Api<RawApi>>,
  config: Config,
) => {
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

  userBot.hears(Commands.Homeworks, async (ctx) => {
    const { message, keyboard } = await getHomeworksMessage();
    await ctx.reply(message, { reply_markup: keyboard, parse_mode: "HTML" });
  });

  userBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.ShowHomework))
      return next();

    const id = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!id) return;

    const homework = await prisma.homework.findFirst({
      where: {
        id,
        answerEndDate: {
          gt: new Date(),
        },
      },
    });

    if (!homework) return;

    const date = Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(homework.createdAt);

    const keyboard = new InlineKeyboard().text(
      `Выполнить (${date})`,
      `${Commands.SendAnswerHomework}:${homework.id}`,
    );

    if (homework.text) {
      await ctx.reply(homework.text, { reply_markup: keyboard });
    } else if (homework.filePath) {
      await ctx.replyWithDocument(homework.filePath, { reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery(`Задание от ${date}`);
  });

  // Отправка ответа на ДЗ
  userBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.SendAnswerHomework))
      return next();

    const id = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!id) return;

    const event = await prisma.event.findFirst({
      where: {
        id,
        dateStart: {
          gt: new Date()
        }
      },
    });

    if (!event) return;

    ctx.session.answerHomework = id;
    await ctx.reply("Отправьте файл или ссылку");
  });

  userBot.on(":file", async (ctx) => {
    const id = ctx.session.answerHomework;
    if (!id) return;

    const userId = ctx.session.user?.id;
    if (!userId) return;

    const event = await prisma.event.findFirst({
      where: {
        id,
        dateStart: {
          gt: new Date()
        }
      },
    });

    if (!event) return;

    const file = await ctx.getFile();

    const answer = await prisma.homeworkAnswer.findFirst({
      where: {
        homeworkId: id,
        userId,
      },
    });

    await prisma.homeworkAnswer.upsert({
      create: {
        userId,
        homeworkId: id,
        filePath: file.file_id,
      },
      where: {
        id: answer?.id ?? 0,
        userId,
        homeworkId: id,
      },
      update: {
        filePath: file.file_id,
        link: null,
      },
    });

    ctx.session.answerHomework = undefined;

    await ctx.reply(
      "Ответ отправлен! Учитываться будет только последний ответ",
    );
  });

  userBot.on("msg::url", async (ctx) => {
    const id = ctx.session.answerHomework;
    if (!id) return;

    const userId = ctx.session.user?.id;
    if (!userId) return;

    const message = ctx.message?.text;
    if (!message) return;

    const event = await prisma.event.findFirst({
      where: {
        id,
        dateStart: {
          gt: new Date()
        }
      },
    });

    if (!event) return;

    const answer = await prisma.homeworkAnswer.findFirst({
      where: {
        homeworkId: id,
        userId,
      },
    });

    await prisma.homeworkAnswer.upsert({
      create: {
        userId,
        homeworkId: id,
        link: message,
      },
      where: {
        id: answer?.id ?? 0,
        userId,
        homeworkId: id,
      },
      update: {
        filePath: null,
        link: message,
      },
    });

    ctx.session.answerHomework = undefined;

    await ctx.reply(
      "Ответ отправлен! Учитываться будет только последний ответ",
    );
  });

  // Отправить мероприятия
  userBot.hears(Commands.Events, async (ctx) => {
    const { message, keyboard } = await getEventsMessage();

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  });

  // Изменить страницу для ДЗ
  userBot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data?.startsWith(Commands.HomeworksSetPage))
      return next();

    const page = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!page) return;

    const { message, keyboard } = await getHomeworksMessage(page);

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
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

    const userId = ctx.session.user?.id;
    if (!userId) return;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) return;
    ctx.session.user = user;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        dateStart: {
          gt: new Date()
        }
      },
      select: {
        usersCount: true,
        payersCount: true,
        UserEvent: {
          select: {
            user: {
              select: {
                id: true,
                isPayer: true,
              },
            },
          },
        },
      },
    });

    if (!event) return;

    if (event.UserEvent.some(({ user }) => userId === user.id))
      return await ctx.answerCallbackQuery("Вы уже записаны!");

    const count = event.UserEvent.filter(
      ({ user: { isPayer } }) => user.isPayer === isPayer,
    ).length;
    const eventCount = user.isPayer
      ? event.payersCount || 0
      : event.usersCount || 0;

    if (count < eventCount) {
      await prisma.userEvent.create({
        data: {
          userId: user.id,
          eventId,
        },
      });
      await ctx.answerCallbackQuery("Вы успешно записаны!");
    } else {
      await ctx.answerCallbackQuery("Нет мест!");
    }
  });

  // Отписаться от мероприятия
  userBot.use(async (ctx, next) => {
    if (
      !ctx.callbackQuery?.data?.startsWith(Commands.DeleteRegistrationToEvent)
    )
      return next();

    const eventId = parseInt(ctx.callbackQuery.data.split(":")[1]);
    if (!eventId) return;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        dateStart: {
          gt: new Date()
        }
      },
    });

    if (!event) return;

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
};
