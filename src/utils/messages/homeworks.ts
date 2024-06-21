import { InlineKeyboard } from "grammy";
import { prisma } from "../prisma";
import { Commands } from "../../bot";

const pageSize = 5;

export const getHomeworksMessage = async (page = 1, isAdmin = false) => {
  const homeworks = await prisma.homework.findMany({
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: {
      createdAt: "desc",
    },
    where: {
      answerEndDate: !isAdmin
        ? {
          gt: new Date(),
        }
        : {},
    },
  });

  const homeworksCount = await prisma.homework.count({
    where: {
      answerEndDate: !isAdmin
        ? {
          gt: new Date(),
        }
        : {},
    },
  });
  const pagesCount = Math.ceil(homeworksCount / pageSize);

  const keyboard = new InlineKeyboard();
  if (isAdmin) {
    keyboard.text(Commands.CreateHomework, Commands.CreateHomework).row();

    homeworks.forEach((homework, index) => {
      keyboard
        .text(
          `Управлять ${index + 1} (#${homework.id})`,
          `${Commands.HomeworksManage}:${homework.id}`,
        )
        .row();
    });
  } else {
    homeworks.forEach((homework, index) => {
      keyboard
        .text(
          `Посмотреть #${index + 1} (#${homework.id})`,
          `${Commands.ShowHomework}:${homework.id}`,
        )
        .row();
    });
  }

  if (page === 1 && pagesCount > 1) {
    keyboard.text("Следующая страница", `${Commands.HomeworksSetPage}:2`);
  } else if (page === pagesCount && page !== 1) {
    keyboard.text(
      "Предыдущая страница",
      `${Commands.HomeworksSetPage}:${page - 1}`,
    );
  } else if (pagesCount > 1) {
    keyboard.text("<", `${Commands.HomeworksSetPage}:${page - 1}`);
    keyboard.text("первая", `${Commands.HomeworksSetPage}:1`);
    keyboard.text("последняя", `${Commands.HomeworksSetPage}:${pagesCount}`);
    keyboard.text(">", `${Commands.HomeworksSetPage}:${page + 1}`);
  }

  if (!homeworks.length) {
    const message = "Домашних заданий ещё нет!";
    return { message, keyboard };
  }

  const homeworksMessage = homeworks.reduce((acc, homework, index) => {
    acc += `<b>#${index + 1} Задание от ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(homework.createdAt)}</b> (#${homework.id})\nОтветы принимаются до ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(homework.answerEndDate)}\n\n`;
    return acc;
  }, "");

  const message = `Список домашних заданий (Кнопками выберите задание)\n${homeworksMessage}Страница ${page} из ${pagesCount}`;

  return { message, keyboard };
};
