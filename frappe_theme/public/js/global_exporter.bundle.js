import {
	Chart,
	BarController,
	BarElement,
	CategoryScale,
	LinearScale,
	LineController,
	LineElement,
	ArcElement,
	PointElement,
	Tooltip,
	Legend,
	Title,
} from "chart.js";

import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(
	BarController,
	BarElement,
	CategoryScale,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	ArcElement,
	Tooltip,
	Legend,
	Title,
	ChartDataLabels
);

window.Chart = Chart;
