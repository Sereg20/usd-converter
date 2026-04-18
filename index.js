require('dotenv').config();
const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const QuickChart = require('quickchart-js');

// ==========================================
// 1. БАЗОВАЯ ЛОГИКА (Получение данных)
// ==========================================

async function getUsdRate(date) {
  const dateString = date.toISOString().split('T')[0];
  const url = `https://api.nbrb.by/exrates/rates/431?ondate=${dateString}`;
  const response = await axios.get(url);
  return response.data.Cur_OfficialRate;
}

// Функция возвращает "сырые" данные без форматирования
async function getRatesData() {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const rateToday = await getUsdRate(today);
  const rateYesterday = await getUsdRate(yesterday);
  const diff = parseFloat((rateToday - rateYesterday).toFixed(4));

  return {
    rateToday,
    rateYesterday,
    diff
  };
}

// Получение истории курса за период
async function getMonthlyDynamics() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30); // Отматываем на 30 дней назад

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // API для получения динамики
  const url = `https://api.nbrb.by/exrates/rates/dynamics/431?startdate=${startStr}&enddate=${endStr}`;
  const response = await axios.get(url);
  return response.data; // Возвращает массив объектов
}

// Генерация ссылки на картинку с графиком
async function getChartUrl() {
  const data = await getMonthlyDynamics();

  // Подготавливаем данные для осей X (даты) и Y (курсы)
  const labels = data.map(item => {
    const d = new Date(item.Date);
    return `${d.getDate()}.${d.getMonth() + 1}`; // Формат "ДД.ММ"
  });
  const rates = data.map(item => item.Cur_OfficialRate);

  // Настраиваем график
  const chart = new QuickChart();
  chart.setWidth(600);
  chart.setHeight(400);
  chart.setBackgroundColor('white');

  chart.setConfig({
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Курс USD к BYN',
        data: rates,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        fill: true,
        borderWidth: 2,
        pointRadius: 2 // Точки на графике
      }]
    },
    options: {
      legend: { display: false },
      title: { display: true, text: 'Динамика USD за 30 дней' }
    }
  });

  return chart.getUrl(); // Возвращает готовую ссылку на картинку
}

// ==========================================
// 2. РЕЖИМ ЛОКАЛЬНОЙ ОТЛАДКИ
// ==========================================

if (process.argv.includes('--debug')) {
  console.log("🛠 Запуск в режиме отладки (запрос к API)...\n");

  (async () => {
    try {
      const data = await getRatesData();
      console.log("=== ОТВЕТ СЕРВЕРА НБРБ ===");
      console.log(data); // Выводим чистый JSON-объект
      console.log("==========================");
      process.exit(0);
    } catch (error) {
      console.error("❌ Ошибка при получении данных:", error.message);
      process.exit(1);
    }
  })();

} else {

  // ==========================================
  // 3. ЛОГИКА TELEGRAM БОТА
  // ==========================================

  const bot = new Telegraf(process.env.BOT_TOKEN);
  const CHAT_ID = process.env.CHAT_ID;

  // Функция для формирования красивого текста специально для Telegram
  function formatTelegramMessage(data) {
    let trend = '➖ Без изменений';
    if (data.diff > 0) trend = `📈 Вырос на ${data.diff}`;
    if (data.diff < 0) trend = `📉 Упал на ${Math.abs(data.diff)}`;

    return `🇧🇾 **Курс НБРБ (USD -> BYN)**\n\n💵 Сегодня: **${data.rateToday} BYN**\n🕒 Вчера: ${data.rateYesterday} BYN\n📊 Тренд: ${trend}`;
  }

  async function sendRate(ctx = null) {
    try {
      const data = await getRatesData();
      const message = formatTelegramMessage(data); // Применяем форматирование

      if (ctx) {
        await ctx.replyWithMarkdown(message);
      } else if (CHAT_ID) {
        await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log("✅ Курс отправлен по расписанию.");
      }
    } catch (error) {
      console.error("❌ Ошибка отправки:", error.message);
      if (ctx) ctx.reply("Произошла ошибка при получении курса.");
    }
  }

  const mainKeyboard = {
    reply_markup: {
      keyboard: [
        [{ text: "💵 Узнать курс USD" }, { text: "📊 График за месяц" }] // Две кнопки в один ряд
      ],
      resize_keyboard: true
    }
  };

  bot.start((ctx) => {
    ctx.reply(
      `Привет! Я буду присылать курс в 12:00.\nТвой ID: ${ctx.chat.id}\n\nТы также можешь запросить курс в любой момент кнопкой ниже.`,
      mainKeyboard
    );
  });

  bot.command('rate', (ctx) => sendRate(ctx));
  bot.hears(/курс/i, (ctx) => sendRate(ctx));
  bot.hears("💵 Узнать курс USD", (ctx) => sendRate(ctx));
  bot.hears("📊 График за месяц", async (ctx) => {
    try {
      // Отправляем временное сообщение, пока API рисует график
      const waitMsg = await ctx.reply("⏳ Рисую график, секундочку...");

      const chartUrl = await getChartUrl();

      // Отправляем картинку
      await ctx.replyWithPhoto({ url: chartUrl }, { caption: "Динамика курса за последние 30 дней" });

      // Удаляем временное сообщение с песочными часами
      await ctx.deleteMessage(waitMsg.message_id);
    } catch (error) {
      console.error("❌ Ошибка при генерации графика:", error.message);
      ctx.reply("❌ Не удалось построить график. Попробуй позже.");
    }
  });

  cron.schedule('0 12 * * *', () => {
    console.log("⏰ Сработал таймер 12:00");
    sendRate();
  }, {
    scheduled: true,
    timezone: "Europe/Minsk"
  });

  bot.launch().then(() => console.log("🤖 Бот запущен!"));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}