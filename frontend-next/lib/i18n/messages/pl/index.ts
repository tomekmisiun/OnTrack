import { appMessages } from "./app";
import { calendarMessages } from "./calendar";
import { exportMessages } from "./export";
import { loginMessages } from "./login";
import { macroMessages } from "./macro";
import { miscMessages } from "./misc";
import { productsMessages } from "./products";
import { recipesMessages } from "./recipes";
import { scheduleMessages } from "./schedule";
import { summaryMessages } from "./summary";

export const plMessages = {
  ...appMessages,
  ...calendarMessages,
  ...exportMessages,
  ...loginMessages,
  ...macroMessages,
  ...miscMessages,
  ...productsMessages,
  ...recipesMessages,
  ...scheduleMessages,
  ...summaryMessages,
} as const;
