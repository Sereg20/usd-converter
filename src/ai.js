const Parser = require('rss-parser');
const { GoogleGenAI } = require('@google/genai');

const parser = new Parser();

async function getNewsSummary() {
  const feeds = [
    { url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss', type: 'RU' },
    { url: 'https://lenta.ru/rss/news/economics', type: 'RU' },
    { url: 'https://www.investing.com/rss/news_1.rss', type: 'US' },
    { url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml', type: 'US' }
  ];

  let allNews = []; // Теперь сюда будем складывать объекты с датами
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const keywords = [
    'цб', 'ставка', 'инфляция', 'доллар', 'рубль', 'byn', 'налог', 'минфин', 'fed', 'rate', 'cpi', 'dollar',
    'нефть', 'газ', 'brent', 'urals', 'опек', 'opec', 'баррель', 'barrel', 'энергоресурсы', 'эмбарго', 'потолок цен', 'oil', 'gas',
    'война', 'конфликт', 'сво', 'всу', 'армия', 'обстрел', 'наступление', 'фронт', 'мобилизация', 'war', 'conflict', 'military',
    'США', 'перемирие', 'переговоры', 'мир', 'прекращение огня', 'эскалация', 'деэскалация', 'peace', 'truce', 'negotiations'
  ];

  await Promise.all(feeds.map(async (feed) => {
    try {
      const parsed = await parser.parseURL(feed.url);
      let feedNews = []; // Локальный массив для конкретного источника

      parsed.items.forEach(item => {
        const pubDate = new Date(item.pubDate).getTime();
        if (pubDate > oneDayAgo) {
          const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
          if (keywords.some(kw => text.includes(kw))) {
            // Сохраняем не просто текст, а объект с датой для сортировки
            feedNews.push({
              text: `[${feed.type}] ${item.title}`,
              timestamp: pubDate
            });
          }
        }
      });

      // Сортируем новости ЭТОГО источника от новых к старым
      feedNews.sort((a, b) => b.timestamp - a.timestamp);

      // Берем максимум 5 самых свежих новостей из одного источника
      allNews.push(...feedNews.slice(0, 5));

    } catch (error) {
      console.error(`Ошибка парсинга ${feed.url}:`, error.message);
    }
  }));

  // Теперь у нас есть сбалансированная сборная солянка (макс. 20 новостей).
  // Сортируем весь итоговый список по времени (самые свежие сверху).
  allNews.sort((a, b) => b.timestamp - a.timestamp);

  // Оставляем топ-15, превращаем объекты обратно в текст и склеиваем в строку
  return allNews.slice(0, 15).map(item => item.text).join('\n');
}

async function getAiForecast() {
  const news = await getNewsSummary();

  if (!news) return "В данный момент нет значимых макроэкономических новостей за последние 24 часа для анализа.";


  const ai = new GoogleGenAI({});
  const prompt = `Ты строгий финансовый аналитик. Твоя задача: оценить влияние новостей за последние 24 часа на курс белорусского рубля (BYN) к доллару США (USD). Учти сильную корреляцию BYN с российским рублем.

Вот список отфильтрованных новостей:
${news}

Ответь кратко, без воды, используя форматирование Markdown:
1. 🌍 **Общий фон:** (Позитив / Негатив / Нейтрально для BYN)
2. 🔑 **Главный фактор:** (Одно предложение, что влияет сильнее всего)
3. 📈 **Прогноз тренда USD/BYN:** (Рост / Падение / Флэт)
4. 💡 **Резюме:** (2-3 предложения с выводами)`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });

    return response.text;
  } catch (error) {
    console.error("❌ Ошибка Gemini API:", error);
    throw new Error("Сбой на стороне нейросети");
  }
}

module.exports = { getAiForecast, getNewsSummary };