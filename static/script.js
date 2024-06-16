document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('cpuUsageChart').getContext('2d');
    let cpuUsageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'CPU Usage (millicores)'
                    }
                }
            }
        }
    });

    function updateChart(data) {
        console.log("Updating chart with data:", data); // Logowanie danych do konsoli
        cpuUsageChart.data.labels = data.labels;
        cpuUsageChart.data.datasets = data.datasets.map(dataset => ({
            ...dataset,
            borderColor: getRandomColor(),
            backgroundColor: getRandomColor(0.2)
        }));
        cpuUsageChart.update();
    }

    async function fetchData() {
        const namespace = document.getElementById('namespace').value;
        const pod = document.getElementById('pod').value;
        const start_time = document.getElementById('start_time').value;
        const end_time = document.getElementById('end_time').value;
        console.log(`Fetching data for namespace=${namespace}, pod=${pod}, start_time=${start_time}, end_time=${end_time}`); // Logowanie parametrów do konsoli
        const response = await fetch(`/api/cpu_usage?namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(pod)}&start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}`);
        const data = await response.json();
        console.log("Fetched data:", data); // Logowanie odebranych danych do konsoli
        updateChart(data);
    }

    function setDefaultTimeRange() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        document.getElementById('start_time').value = oneHourAgo.toISOString().slice(0, 16);
        document.getElementById('end_time').value = now.toISOString().slice(0, 16);
    }

    function getRandomColor(opacity = 1) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    document.getElementById('timeRangeForm').addEventListener('submit', function(event) {
        event.preventDefault();
        fetchData();
    });

    setDefaultTimeRange();
    fetchData();
    setInterval(fetchData, 60000); // Refresh every minute
});
