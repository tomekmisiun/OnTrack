import { appMessages } from "./app";
import { calendarMessages } from "./calendar";
import { exportMessages } from "./export";
import { loginMessages } from "./login";
import { macroMessages } from "./macro";
import { productsMessages } from "./products";
import { recipesMessages } from "./recipes";
import { scheduleMessages } from "./schedule";
import { summaryMessages } from "./summary";

export const enMessages = {
  ...appMessages,
  ...calendarMessages,
  ...exportMessages,
  ...loginMessages,
  ...macroMessages,
  ...productsMessages,
  ...recipesMessages,
  ...scheduleMessages,
  ...summaryMessages,
} as const;
