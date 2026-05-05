const axios = require('axios');

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

// Экспортируем функции, чтобы их можно было использовать в других файлах
module.exports = {
  getUsdRate,
  getRatesData,
  getMonthlyDynamics
};