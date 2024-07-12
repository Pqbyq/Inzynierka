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

    $('#namespace').change(function () {
        var namespace = $('#namespace').val();
        $.ajax({
            url: '/api/pods',
            type: 'GET',
            data: {
                namespace: namespace
            },
            success: function (data) {
                var podSelect = $('#pod');
                podSelect.empty();
                data.pods.forEach(function (pod) {
                    podSelect.append($('<option>', {
                        value: pod,
                        text: pod
                    }));
                });
            }
        });
    });

    $("#timeRangeForm").on("submit", function (event) {
        event.preventDefault();
        var namespace = $('#namespace').val();
        var pods = $('#pod').val();
        var startTime = $('#start_time').val();
        var endTime = $('#end_time').val();
        fetchData(namespace, pods, startTime, endTime); // Przekazujemy jako tablica
    });

    function fetchData(namespace, pods, startTime, endTime) {
        console.log(`Fetching data for namespace: ${namespace} pods: ${pods} start_time: ${startTime} end_time: ${endTime}`);
        
        if (!namespace || !pods || !startTime || !endTime) {
            console.error("One or more parameters are undefined");
            return;
        }

        $.ajax({
            url: "/api/usage",
            type: 'GET',
            traditional: true,
            data: {
                namespace: namespace,
                'pods[]': pods, // Przekazujemy jako tablica
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
                return { x: new Date(point.x).toISOString(), y: point.y, namespace: point.namespace, name: point.name };
            }));
            series.name(dataset.label + " (CPU)");

            var randomColor = getRandomColor();
            series.stroke(randomColor);
            series.fill(randomColor);

            series.tooltip().useHtml(true).format(function () {
                return `<strong>Namespace:</strong> ${this.getData('namespace')}<br><strong>Pod:</strong> ${this.getData('name')}<br><strong>CPU Usage:</strong> ${this.value}<br><strong>Timestamp:</strong> ${moment(this.x).tz(tz).format('YYYY-MM-DD HH:mm:ss')}`;
            });
        });

        memoryDatasets.forEach(function (dataset) {
            var series = memoryChart.line(dataset.data.map(function (point) {
                return { x: new Date(point.x).toISOString(), y: point.y, namespace: point.namespace, name: point.name };
            }));
            series.name(dataset.label + " (Memory)");

            var randomColor = getRandomColor();
            series.stroke(randomColor);
            series.fill(randomColor);

            series.tooltip().useHtml(true).format(function () {
                return `<strong>Namespace:</strong> ${this.getData('namespace')}<br><strong>Pod:</strong> ${this.getData('name')}<br><strong>Memory Usage:</strong> ${this.value}<br><strong>Timestamp:</strong> ${moment(this.x).tz(tz).format('YYYY-MM-DD HH:mm:ss')}`;
            });
        });

        cpuChart.legend(true);
        cpuChart.legend().itemsFormat("{%seriesName}");
        cpuChart.xAxis().labels().format(function (value) {
            return moment(value).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        });

        memoryChart.legend(true);
        memoryChart.legend().itemsFormat("{%seriesName}");
        memoryChart.xAxis().labels().format(function (value) {
            return moment(value).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        });

        cpuChart.draw();
        memoryChart.draw();
    }
});
