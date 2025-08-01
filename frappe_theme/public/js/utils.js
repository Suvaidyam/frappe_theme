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
    let country_code = locals?.['Country']?.[frappe.sys_defaults?.country]?.code?.toUpperCase() || 'US';
    const formatter = new Intl.NumberFormat(`${frappe.sys_defaults?.lang || 'en'}-${country_code}`, {
        style: 'currency',
        currency: currencyCode || 'INR',
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

function custom_eval(expr, doc) {
    if (expr.startsWith('eval:')) {
        expr = expr.slice(5);
    }
    let result = new Function('doc', `return ${expr};`)(doc);
    return result;
}
function getDistrictRoute(state_name) {
    let base_route = '/assets/frappe_theme/boundaries/district/'
    state_name = state_name?.replace("&", "and");
    let state = state_name?.toLowerCase()?.split(" ")?.join("-");
    const final_route = `${base_route}${state}.json`
    return final_route;
};
frappe.utils.format_currency = formatCurrencyWithSuffix;
frappe.utils.custom_eval = custom_eval;
frappe.utils.get_district_json_route = getDistrictRoute;

function toggleFieldError(context, fieldname, message, toggle = true, is_child = false) {
    if (!is_child) {
        let field = context.fields_dict[fieldname];
        let error_message = '';
        if (field?.description) {
            error_message = `<span class="text-danger">${__(message)}</span><br>${field?.description}`;
        } else {
            error_message = `<span class="text-danger">${__(message)}</span>`;
        }
        if (toggle) {
            context.set_df_property(fieldname, 'description', error_message);
            $(field.$wrapper).addClass('has-error');
            frappe.validate = false;
            throw new Error(message);
        } else {
            if (field?.description) {
                context.set_df_property(fieldname, 'description', field?.description);
            } else {
                context.set_df_property(fieldname, 'description', '');
            }
            $(field.$wrapper).removeClass('has-error');
            frappe.validate = true;
        }
    } else {
        if (toggle) {
            const isDialog = context?.$wrapper && context.get_value;
            const isForm = context?.fields_dict && context.doc;

            // Show error message
            if (isDialog && context?.show_message) {
                context.show_message('');
                context.show_message(__(message), 'red');
                frappe.validate = false;
                throw new Error(message);
            }
            else if (isForm) {
                frappe.throw(message);
            }
        } else {
            const isDialog = context?.$wrapper && context.get_value;
            if (isDialog && context?.show_message) {
                context.show_message('');
            }
        }
    }
}

frappe.utils.toggleFieldError = toggleFieldError;

function makeDialogFullScreen(dialog) {
    // Write logic to ensure that the dialog is full screen
    let dbody = $(dialog.$wrapper).find('.modal-dialog');
    let dbody_content = $(dialog.$wrapper).find('.modal-content');
    dbody?.css({
        'min-width': '100%',
        'width': '100%',
        'max-width': '100%',
        'margin': '0',
        'padding': '0',
    });
    dbody_content?.css({
        'min-height': '100vh',
        'height': '100vh !important',
        'border-radius': '0'
    });
}
frappe.utils.make_dialog_fullscreen = makeDialogFullScreen;

function getUserAvatar(fullName) {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    const firstInitial = parts[0]?.[0]?.toUpperCase() || "";
    const lastInitial = parts[1]?.[0]?.toUpperCase() || "";
    return firstInitial + lastInitial;
}
frappe.utils.get_user_avatar = getUserAvatar;