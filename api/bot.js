const { Telegraf } = require('telegraf');

// Импортируем наши сервисы
const { getRatesData, getUsdRate } = require('../src/nbrb');
const { getChartUrl } = require('../src/chart');
const { getAiForecast } = require('../src/ai');

const bot = new Telegraf(process.env.BOT_TOKEN);

const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "💵 Узнать курс USD" }, { text: "📊 График за месяц" }],
      [{ text: "🔮 AI Прогноз" }]
    ],
    resize_keyboard: true
  }
};

bot.start((ctx) => {
  ctx.reply(
    "Привет! Выбери действие на клавиатуре ниже.\n\n💡 **Лайфхак:** отправь мне любую сумму (например, `100$`, `50 byn` или просто `100`), и я мгновенно её конвертирую!",
    { ...mainKeyboard, parse_mode: 'Markdown' }
  );
});

// === 1. ЗАПРОС КУРСА ===
function formatTelegramMessage(data) {
  let trend = '➖ Без изменений';
  if (data.diff > 0) trend = `📈 Вырос на ${data.diff}`;
  if (data.diff < 0) trend = `📉 Упал на ${Math.abs(data.diff)}`;
  return `🇧🇾 **Курс НБРБ (USD -> BYN)**\n\n💵 Сегодня: **${data.rateToday} BYN**\n🕒 Вчера: ${data.rateYesterday} BYN\n📊 Тренд: ${trend}`;
}

async function sendRate(ctx) {
  try {
    const data = await getRatesData();
    const message = formatTelegramMessage(data);
    await ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error("❌ Ошибка отправки:", error.message);
    ctx.reply("Произошла ошибка при получении курса.");
  }
}

bot.command('rate', (ctx) => sendRate(ctx));
bot.hears(/курс/i, (ctx) => sendRate(ctx));
bot.hears("💵 Узнать курс USD", (ctx) => sendRate(ctx));

// === 2. КОНВЕРТЕР ===
bot.hears(/^\s*(\d+(?:[.,]\d+)?)\s*(usd|\$|дол|доллар|byn|р|руб|бел)?\s*$/i, async (ctx) => {
  try {
    const amount = parseFloat(ctx.match[1].replace(',', '.'));
    const currency = ctx.match[2] ? ctx.match[2].toLowerCase() : null;

    const rate = await getUsdRate(new Date());
    let replyText = '';

    const isUsd = ['usd', '$', 'дол', 'доллар'].includes(currency);
    const isByn = ['byn', 'р', 'руб', 'бел'].includes(currency);

    if (isUsd) {
      replyText = `🇺🇸 **${amount} USD** = 🇧🇾 **${(amount * rate).toFixed(2)} BYN**`;
    } else if (isByn) {
      replyText = `🇧🇾 **${amount} BYN** = 🇺🇸 **${(amount / rate).toFixed(2)} USD**`;
    } else {
      replyText = `⚖️ **Конвертация ${amount}:**\n\n🇺🇸 ${amount} USD = 🇧🇾 **${(amount * rate).toFixed(2)} BYN**\n🇧🇾 ${amount} BYN = 🇺🇸 **${(amount / rate).toFixed(2)} USD**`;
    }

    await ctx.replyWithMarkdown(replyText);
  } catch (error) {
    console.error("❌ Ошибка при конвертации:", error.message);
    ctx.reply("❌ Произошла ошибка при расчете. Попробуй позже.");
  }
});

// === 3. ГРАФИК ===
bot.hears("📊 График за месяц", async (ctx) => {
  try {
    const waitMsg = await ctx.reply("⏳ Запрашиваю данные у НБРБ...");
    const chartUrl = await getChartUrl();
    await ctx.replyWithPhoto({ url: chartUrl }, { caption: "Динамика курса за последние 30 дней" });
    await ctx.deleteMessage(waitMsg.message_id);
  } catch (error) {
    console.error("❌ Ошибка при генерации графика:", error.message);
    ctx.reply("❌ Не удалось построить график. Попробуй позже.");
  }
});

// === 4. ИИ ПРОГНОЗ ===
bot.hears("🔮 AI Прогноз", async (ctx) => {
  try {
    const waitMsg = await ctx.reply("⏳ Собираю финансовые сводки и запускаю нейросеть Gemini. Секундочку...");
    const forecast = await getAiForecast();
    await ctx.replyWithMarkdown(forecast);
    await ctx.deleteMessage(waitMsg.message_id);
  } catch (error) {
    console.error("❌ Ошибка при генерации AI прогноза:", error.message);
    ctx.reply("❌ Не удалось получить прогноз. Возможно, проблемы с API или таймаут.");
  }
});

// === ЭКСПОРТ ДЛЯ VERCEL ===
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('Бот жив и работает на Vercel!');
  }
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке апдейта:', error);
    res.status(500).send('Error handling update');
  }
};