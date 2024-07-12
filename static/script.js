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

        var seriesDataCPU = cpuDatasets.map(function (dataset) {
            return {
                name: dataset.label,
                data: dataset.data.map(function (point) {
                    return [new Date(point.x).getTime(), point.y];
                })
            };
        });

        var seriesDataMemory = memoryDatasets.map(function (dataset) {
            return {
                name: dataset.label,
                data: dataset.data.map(function (point) {
                    return [new Date(point.x).getTime(), point.y];
                })
            };
        });

        Highcharts.chart('cpu_usage_chart', {
            chart: {
                type: 'line'
            },
            title: {
                text: 'CPU Usage Over Time'
            },
            xAxis: {
                type: 'datetime',
                title: {
                    text: 'Time'
                }
            },
            yAxis: {
                title: {
                    text: 'CPU Usage'
                },
                min: 0
            },
            tooltip: {
                shared: true,
                useHTML: true,
                formatter: function () {
                    var tooltip = '<b>' + Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '</b><br/>';
                    this.points.forEach(function (point) {
                        tooltip += '<span style="color:' + point.series.color + '">\u25CF</span> ' + point.series.name + ': <b>' + point.y + '</b><br/>';
                    });
                    return tooltip;
                }
            },
            series: seriesDataCPU
        });

        Highcharts.chart('memory_usage_chart', {
            chart: {
                type: 'line'
            },
            title: {
                text: 'Memory Usage Over Time'
            },
            xAxis: {
                type: 'datetime',
                title: {
                    text: 'Time'
                }
            },
            yAxis: {
                title: {
                    text: 'Memory Usage'
                },
                min: 0
            },
            tooltip: {
                shared: true,
                useHTML: true,
                formatter: function () {
                    var tooltip = '<b>' + Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '</b><br/>';
                    this.points.forEach(function (point) {
                        tooltip += '<span style="color:' + point.series.color + '">\u25CF</span> ' + point.series.name + ': <b>' + point.y + '</b><br/>';
                    });
                    return tooltip;
                }
            },
            series: seriesDataMemory
        });
    }
});
