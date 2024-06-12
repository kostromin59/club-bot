import { InlineKeyboard } from "grammy";
import { prisma } from "../prisma";
import { Commands } from "../../bot";

const pageSize = 1;

export const getHomeWorksMessage = async (page = 1, isAdmin = false) => {
  const homeWorks = await prisma.homeWork.findMany({
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

  const homeWorksCount = await prisma.homeWork.count({
    where: {
      answerEndDate: !isAdmin
        ? {
            gt: new Date(),
          }
        : {},
    },
  });
  const pagesCount = Math.ceil(homeWorksCount / pageSize);

  const keyboard = new InlineKeyboard();
  if (isAdmin) {
    keyboard.text(Commands.CreateHomeWork, Commands.CreateHomeWork).row();

    homeWorks.forEach((homeWork, index) => {
      keyboard
        .text(
          `Управлять ${index + 1}`,
          `${Commands.HomeWorksManage}:${homeWork.id}`,
        )
        .row();
    });
  } else {
    homeWorks.forEach((homeWork, index) => {
      keyboard
        .text(
          `Посмотреть #${index + 1}`,
          `${Commands.ShowHomeWork}:${homeWork.id}`,
        )
        .row();
    });
  }

  if (page === 1 && pagesCount > 1) {
    keyboard.text("Следующая страница", `${Commands.HomeWorksSetPage}:2`);
  } else if (page === pagesCount && page !== 1) {
    keyboard.text(
      "Предыдущая страница",
      `${Commands.HomeWorksSetPage}:${page - 1}`,
    );
  } else if (pagesCount > 1) {
    keyboard.text("<", `${Commands.HomeWorksSetPage}:${page - 1}`);
    keyboard.text("первая", `${Commands.HomeWorksSetPage}:1`);
    keyboard.text("последняя", `${Commands.HomeWorksSetPage}:${pagesCount}`);
    keyboard.text(">", `${Commands.HomeWorksSetPage}:${page + 1}`);
  }

  if (!homeWorks.length) {
    const message = "Домашних заданий ещё нет!";
    return { message, keyboard };
  }

  const homeWorksMessage = homeWorks.reduce((acc, homeWork, index) => {
    acc += `<b>Задание от ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(homeWork.createdAt)}</b> (#${index + 1})\nОтветы принимаются до ${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(homeWork.answerEndDate)}\n\n`;
    return acc;
  }, "");

  const message = `Список домашних заданий (Кнопками выберите задание)${homeWorksMessage}Страница ${page} из ${pagesCount}`;

  return { message, keyboard };
};
