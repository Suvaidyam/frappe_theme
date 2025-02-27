const formaDate = (date) => {
    let my_date_format = frappe.sys_defaults?.date_format;
    let d = new Date(date);
    let formatted_date = '';

    const padZero = (num) => (num < 10 ? '0' : '') + num;

    const day = padZero(d.getDate());
    const month = padZero(d.getMonth() + 1); // Months are zero-based
    const year = d.getFullYear();

    if (my_date_format === 'dd-mm-yyyy') {
        formatted_date = `${day}-${month}-${year}`;
    } else if (my_date_format === 'mm-dd-yyyy') {
        formatted_date = `${month}-${day}-${year}`;
    } else if (my_date_format === 'yyyy-mm-dd') {
        formatted_date = `${year}-${month}-${day}`;
    } else if (my_date_format === 'yyyy-dd-mm') {
        formatted_date = `${year}-${day}-${month}`;
    } else if (my_date_format === 'dd/mm/yyyy') {
        formatted_date = `${day}/${month}/${year}`;
    } else if (my_date_format === 'dd.mm.yyyy') {
        formatted_date = `${day}.${month}.${year}`;
    } else if (my_date_format === 'mm/dd/yyyy') {
        formatted_date = `${month}/${day}/${year}`;
    } else {
        formatted_date = `${year}/${month}/${day}`;
    }
    return formatted_date;
};

function formatCurrency(amount, currencyCode) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
    });
    return formatter.format(amount);
}

function formatCurrencyWithSuffix(amount) {
    let currencyCode = frappe.sys_defaults?.currency;
    const suffixMaps = {
        INR: [
            { threshold: 10000000, suffix: 'Cr', divisor: 10000000 },
            { threshold: 100000, suffix: 'L', divisor: 100000 }
        ],
        default: [
            { threshold: 1000000000, suffix: 'B', divisor: 1000000000 },
            { threshold: 1000000, suffix: 'M', divisor: 1000000 },
            { threshold: 1000, suffix: 'K', divisor: 1000 }
        ]
    };

    const suffixes = suffixMaps[currencyCode] || suffixMaps.default;
    const absAmount = Math.abs(amount);

    for (const { threshold, suffix, divisor } of suffixes) {
        if (absAmount >= threshold) {
            return formatCurrency(amount / divisor, currencyCode) + ' ' + suffix;
        }
    }

    return formatCurrency(amount, currencyCode);
}

frappe.utils.format_currency = formatCurrencyWithSuffix;