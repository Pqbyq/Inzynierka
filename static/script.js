$(function () {
    var tz = "Europe/Warsaw";
    var chart;  // Zmienna dla wykresu

    $('#start_time').datetimepicker({
        format: 'YYYY-MM-DDTHH:mm',
        useCurrent: false,
        timeZone: tz
    });
    $('#end_time').datetimepicker({
        format: 'YYYY-MM-DDTHH:mm',
        useCurrent: false,
        timeZone: tz
    });

    $('#namespace, #pod').change(function () {
        var namespace = $('#namespace').val();
        var pod = $('#pod').val();
        var startTime = $('#start_time').val();
        var endTime = $('#end_time').val();
        fetchData(namespace, pod, startTime, endTime);
    });

    $("#timeRangeForm").on("submit", function (event) {
        event.preventDefault();
        var namespace = $('#namespace').val();
        var pod = $('#pod').val();
        var startTime = $('#start_time').val();
        var endTime = $('#end_time').val();
        fetchData(namespace, pod, startTime, endTime);
    });

    function fetchData(namespace, pod, startTime, endTime) {
        console.log(`Fetching data for namespace: ${namespace} pod: ${pod} start_time: ${startTime} end_time: ${endTime}`);
        $.ajax({
            url: "/api/cpu_usage",
            data: {
                namespace: namespace,
                pod: pod,
                start_time: startTime,
                end_time: endTime
            },
            success: function (data) {
                console.log("Data received from API:", data);
                if (!data.datasets || data.datasets.length === 0) {
                    console.warn("No datasets received.");
                }
                updateChart(data.datasets, data.labels);
            },
            error: function (xhr, status, error) {
                console.error("Error fetching data:", error);
            }
        });
    }

    function getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    function updateChart(datasets, labels) {
        console.log("Updating chart with data:", datasets);

        var maxY = 0;
        datasets.forEach(function (dataset) {
            dataset.data.forEach(function (point) {
                if (point.y > maxY) {
                    maxY = point.y;
                }
            });
        });

        if (!chart) {
            chart = anychart.line();
            chart.container("cpu_usage_chart");
        } else {
            chart.removeAllSeries();
        }

        chart.yScale().maximum(maxY);
        chart.yScale().minimum(0); // Ensuring the Y-axis starts at 0

        datasets.forEach(function (dataset) {
            var series = chart.line(dataset.data);
            series.name(dataset.label);

            // Assign a random color to each series
            var randomColor = getRandomColor();
            series.stroke(randomColor);
            series.fill(randomColor);

            // Tooltip settings
            series.tooltip().format(function() {
                var pointData = this.points[0].data;
                return `Namespace: ${pointData.namespace}<br>Pod: ${pointData.name}<br>CPU Usage: ${this.value}<br>Timestamp: ${moment(this.x).tz(tz).format('YYYY-MM-DD HH:mm:ss')}`;
            });
        });

        chart.xAxis().labels().format(function () {
            return moment(this.value).tz(tz).format('HH:mm');
        });

        chart.tooltip().titleFormat(function() {
            return moment(this.points[0].x).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        });

        chart.draw();
    }

    // Initial data fetch
    var namespace = $('#namespace').val();
    var pod = $('#pod').val();
    var startTime = $('#start_time').val();
    var endTime = $('#end_time').val();
    fetchData(namespace, pod, startTime, endTime);

    // Set interval to fetch data every minute and update chart
    setInterval(function () {
        namespace = $('#namespace').val();
        pod = $('#pod').val();
        startTime = $('#start_time').val();
        endTime = $('#end_time').val();
        fetchData(namespace, pod, startTime, endTime);
    }, 60000); // 60000 ms = 1 minute
});
