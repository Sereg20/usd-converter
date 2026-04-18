const { Telegraf } = require('telegraf');
const axios = require('axios');
const QuickChart = require('quickchart-js');

// ==========================================
// 1. БАЗОВАЯ ЛОГИКА (Data Layer)
// ==========================================

async function getUsdRate(date) {
    const dateString = date.toISOString().split('T')[0];
    const url = `https://api.nbrb.by/exrates/rates/431?ondate=${dateString}`;
    const response = await axios.get(url);
    return response.data.Cur_OfficialRate;
}

async function getRatesData() {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const rateToday = await getUsdRate(today);
    const rateYesterday = await getUsdRate(yesterday);
    const diff = parseFloat((rateToday - rateYesterday).toFixed(4));

    return { rateToday, rateYesterday, diff };
}

async function getMonthlyDynamics() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = `https://api.nbrb.by/exrates/rates/dynamics/431?startdate=${startStr}&enddate=${endStr}`;
    const response = await axios.get(url);
    return response.data;
}

async function getChartUrl() {
    const data = await getMonthlyDynamics();
    
    const labels = data.map(item => {
        const d = new Date(item.Date);
        return `${d.getDate()}.${d.getMonth() + 1}`;
    });
    const rates = data.map(item => item.Cur_OfficialRate);

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
                pointRadius: 2
            }]
        },
        options: {
            legend: { display: false },
            title: { display: true, text: 'Динамика USD за 30 дней' }
        }
    });

    return chart.getUrl();
}

// ==========================================
// 2. ЛОГИКА ТЕЛЕГРАМ БОТА
// ==========================================

const bot = new Telegraf(process.env.BOT_TOKEN);

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

const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "💵 Узнать курс USD" }, { text: "📊 График за месяц" }]
        ],
        resize_keyboard: true
    }
};

bot.start((ctx) => {
    ctx.reply("Привет! Выбери действие на клавиатуре ниже:", mainKeyboard);
});

bot.command('rate', (ctx) => sendRate(ctx));
bot.hears(/курс/i, (ctx) => sendRate(ctx));
bot.hears("💵 Узнать курс USD", (ctx) => sendRate(ctx));

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

// ==========================================
// 3. ЭКСПОРТ ДЛЯ VERCEL (Serverless Handler)
// ==========================================

module.exports = async (req, res) => {
    // Если просто перейти по ссылке в браузере
    if (req.method === 'GET') {
        return res.status(200).send('Бот жив и работает на Vercel!');
    }

    // Если запрос пришел от Telegram
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Ошибка при обработке апдейта:', error);
        res.status(500).send('Error handling update');
    }
};