// Подключаем dotenv на случай, если захочешь протестить и саму нейросеть
require('dotenv').config(); 
const { getNewsSummary, getAiForecast } = require('./src/ai');

(async () => {
    try {
        // console.log("⏳ Стучусь в RSS-ленты и фильтрую новости...\n");
        
        // // 1. Проверяем только сбор и фильтрацию новостей
        // const news = await getNewsSummary();
        
        // console.log("=== ОТФИЛЬТРОВАННЫЕ НОВОСТИ (для отправки в ИИ) ===");
        // if (news) {
        //     console.log(news);
        // } else {
        //     console.log("По заданным ключевым словам за последние 24 часа ничего не найдено.");
        // }
        // console.log("===================================================\n");

        // РАСКОММЕНТИРУЙ БЛОК НИЖЕ, если хочешь локально проверить ответ от Gemini.        
        console.log("🧠 Отправляю новости в Gemini для прогноза...");
        const forecast = await getAiForecast();
        console.log("\n=== ОТВЕТ ОТ GEMINI ===");
        console.log(forecast);
        console.log("=======================");

    } catch (error) {
        console.error("❌ Произошла ошибка:", error);
    }
})();