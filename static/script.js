$(function () {
    var tz = "Europe/Warsaw";
    var cpuChart, memoryChart;

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
        
        if (!namespace || !pod || !startTime || !endTime) {
            console.error("One or more parameters are undefined");
            return;
        }

        $.ajax({
            url: "/api/cpu_usage",
            type: 'GET',
            data: {
                namespace: namespace,
                pod: pod,
                start_time: startTime,
                end_time: endTime
            },
            success: function (data) {
                console.log("Data received from API:", data);
                if (!data.cpu_datasets || data.cpu_datasets.length === 0) {
                    console.warn("No CPU datasets received.");
                }
                if (!data.memory_datasets || data.memory_datasets.length === 0) {
                    console.warn("No memory datasets received.");
                }
                updateCharts(data.cpu_datasets, data.memory_datasets, data.labels);
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

    function updateCharts(cpuDatasets, memoryDatasets, labels) {
        console.log("Updating charts with data:", cpuDatasets, memoryDatasets);

        var maxY = 0;
        cpuDatasets.forEach(function (dataset) {
            dataset.data.forEach(function (point) {
                if (point.y > maxY) {
                    maxY = point.y;
                }
            });
        });

        memoryDatasets.forEach(function (dataset) {
            dataset.data.forEach(function (point) {
                if (point.y > maxY) {
                    maxY = point.y;
                }
            });
        });

        var startTime = $('#start_time').val();
        var endTime = $('#end_time').val();

        var minDate = startTime ? new Date(startTime).toISOString() : null;
        var maxDate = endTime ? new Date(endTime).toISOString() : null;

        if (!cpuChart) {
            cpuChart = anychart.line();
            cpuChart.container("cpu_usage_chart");
            cpuChart.xScale(anychart.scales.dateTime());
        } else {
            cpuChart.removeAllSeries();
        }

        if (!memoryChart) {
            memoryChart = anychart.line();
            memoryChart.container("memory_usage_chart");
            memoryChart.xScale(anychart.scales.dateTime());
        } else {
            memoryChart.removeAllSeries();
        }

        if (minDate !== null) {
            cpuChart.xScale().minimum(minDate);
            memoryChart.xScale().minimum(minDate);
        }
        if (maxDate !== null) {
            cpuChart.xScale().maximum(maxDate);
            memoryChart.xScale().maximum(maxDate);
        }

        cpuChart.yScale().maximum(maxY);
        cpuChart.yScale().minimum(0);
        memoryChart.yScale().maximum(maxY);
        memoryChart.yScale().minimum(0);

        cpuDatasets.forEach(function (dataset) {
            var series = cpuChart.line(dataset.data.map(function (point) {
                return { x: new Date(point.x).toISOString(), y: point.y };
            }));
            series.name(dataset.label + " (CPU)");

            var randomColor = getRandomColor();
            series.stroke(randomColor);
            series.fill(randomColor);

            series.tooltip().format(function () {
                return `Namespace: ${this.getData('namespace')}<br>Pod: ${this.getData('name')}<br>CPU Usage: ${this.value}<br>Timestamp: ${moment(this.x).tz(tz).format('YYYY-MM-DD HH:mm:ss')}`;
            });
        });

        memoryDatasets.forEach(function (dataset) {
            var series = memoryChart.line(dataset.data.map(function (point) {
                return { x: new Date(point.x).toISOString(), y: point.y };
            }));
            series.name(dataset.label + " (Memory)");

            var randomColor = getRandomColor();
            series.stroke(randomColor);
            series.fill(randomColor);

            series.tooltip().format(function () {
                return `Namespace: ${this.getData('namespace')}<br>Pod: ${this.getData('name')}<br>Memory Usage: ${this.value}<br>Timestamp: ${moment(this.x).tz(tz).format('YYYY-MM-DD HH:mm:ss')}`;
            });
        });

        cpuChart.legend(true);
        cpuChart.legend().itemsFormat("{%seriesName}");
        cpuChart.xAxis().labels().format(function () {
            return moment(this.value).tz(tz).format('HH:mm');
        });

        cpuChart.tooltip().titleFormat(function() {
            return moment(this.points[0].x).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        });

        memoryChart.legend(true);
        memoryChart.legend().itemsFormat("{%seriesName}");
        memoryChart.xAxis().labels().format(function () {
            return moment(this.value).tz(tz).format('HH:mm');
        });

        memoryChart.tooltip().titleFormat(function() {
            return moment(this.points[0].x).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        });

        cpuChart.draw();
        memoryChart.draw();
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
