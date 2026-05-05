const QuickChart = require('quickchart-js');
const { getMonthlyDynamics } = require('./nbrb'); // Импортируем функцию из соседнего файла

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
      title: { display: true, text: 'Динамика USD за 30 дней' },
      scales: {
        yAxes: [{
          ticks: { beginAtZero: false }
        }]
      }
    }
  });

  return chart.getUrl();
}

module.exports = { getChartUrl };