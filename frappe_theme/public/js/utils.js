const formaDate = (date) => {
	let my_date_format = frappe.sys_defaults?.date_format;
	let d = new Date(date);
	let formatted_date = "";

	const padZero = (num) => (num < 10 ? "0" : "") + num;

	const day = padZero(d.getDate());
	const month = padZero(d.getMonth() + 1); // Months are zero-based
	const year = d.getFullYear();

	if (my_date_format === "dd-mm-yyyy") {
		formatted_date = `${day}-${month}-${year}`;
	} else if (my_date_format === "mm-dd-yyyy") {
		formatted_date = `${month}-${day}-${year}`;
	} else if (my_date_format === "yyyy-mm-dd") {
		formatted_date = `${year}-${month}-${day}`;
	} else if (my_date_format === "yyyy-dd-mm") {
		formatted_date = `${year}-${day}-${month}`;
	} else if (my_date_format === "dd/mm/yyyy") {
		formatted_date = `${day}/${month}/${year}`;
	} else if (my_date_format === "dd.mm.yyyy") {
		formatted_date = `${day}.${month}.${year}`;
	} else if (my_date_format === "mm/dd/yyyy") {
		formatted_date = `${month}/${day}/${year}`;
	} else {
		formatted_date = `${year}/${month}/${day}`;
	}
	return formatted_date;
};

function formatCurrency(amount, currencyCode) {
	let country_code =
		locals?.["Country"]?.[frappe.sys_defaults?.country]?.code?.toUpperCase() || "US";
	const formatter = new Intl.NumberFormat(
		`${frappe.sys_defaults?.lang || "en"}-${country_code}`,
		{
			style: "currency",
			currency: currencyCode || "INR",
		}
	);
	return formatter.format(amount);
}

function formatCurrencyWithSuffix(amount, currencyCode) {
	if (!currencyCode) {
		currencyCode = frappe.sys_defaults?.currency;
	}
	const suffixMaps = {
		INR: [
			{ threshold: 10000000, suffix: "Cr", divisor: 10000000 },
			{ threshold: 100000, suffix: "L", divisor: 100000 },
			{ threshold: 1000, suffix: "K", divisor: 1000 },
		],
		default: [
			{ threshold: 1000000000000, suffix: "T", divisor: 1000000000000 },
			{ threshold: 1000000000, suffix: "B", divisor: 1000000000 },
			{ threshold: 1000000, suffix: "M", divisor: 1000000 },
			{ threshold: 1000, suffix: "K", divisor: 1000 },
		],
	};

	const suffixes = suffixMaps[currencyCode] || suffixMaps.default;
	const absAmount = Math.abs(amount);

	for (const { threshold, suffix, divisor } of suffixes) {
		if (absAmount >= threshold) {
			return formatCurrency(amount / divisor, currencyCode) + " " + suffix;
		}
	}

	return formatCurrency(amount, currencyCode);
}

function custom_eval(expr, doc) {
	if (expr.startsWith("eval:")) {
		expr = expr.slice(5);
	}
	let result = new Function("doc", `return ${expr};`)(doc);
	return result;
}
function getDistrictRoute(state_name) {
	let base_route = "/assets/frappe_theme/boundaries/district/";
	state_name = state_name?.replace("&", "and");
	let state = state_name?.toLowerCase()?.split(" ")?.join("-");
	const final_route = `${base_route}${state}.json`;
	return final_route;
}
frappe.utils.format_currency = formatCurrencyWithSuffix;
frappe.utils.custom_eval = custom_eval;
frappe.utils.get_district_json_route = getDistrictRoute;

function toggleFieldError(
	context,
	fieldname,
	message,
	toggle = true,
	is_child = false,
	msg_type = "error",
	reqd = true
) {
	let msg_class = "";
	let msg_styles = {};
	let icon_path = "";

	if (msg_type === "error") {
		msg_class = "text-danger";
		msg_styles = {
			background: "#fef2f2",
			borderColor: "#ef4444",
			textColor: "#991b1b",
			iconColor: "#ef4444",
		};
		icon_path =
			"M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z";
	} else if (msg_type === "warning") {
		msg_class = "text-warning";
		msg_styles = {
			background: "#fffbeb",
			borderColor: "#f59e0b",
			textColor: "#92400e",
			iconColor: "#f59e0b",
		};
		icon_path =
			"M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z";
	} else if (msg_type === "info") {
		msg_class = "text-info";
		msg_styles = {
			background: "#eff6ff",
			borderColor: "#3b82f6",
			textColor: "#1e40af",
			iconColor: "#3b82f6",
		};
		icon_path =
			"M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.06-.194.049-.377-.03-.528L8.93 6.588zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z";
	} else if (msg_type === "success") {
		msg_class = "text-success";
		msg_styles = {
			background: "#f0fdf4",
			borderColor: "#10b981",
			textColor: "#065f46",
			iconColor: "#10b981",
		};
		icon_path =
			"M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 4.384 6.323a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.07-.01l5-5.5a.75.75 0 0 0-.01-1.08z";
	} else {
		// Default to error styling if unknown type
		msg_class = "text-danger";
		msg_styles = {
			background: "#fef2f2",
			borderColor: "#ef4444",
			textColor: "#991b1b",
			iconColor: "#ef4444",
		};
		icon_path =
			"M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z";
		msg_type = "error";
	}
	if (!is_child) {
		let field = context.fields_dict[fieldname];
		let error_message = "";
		if (field?.description) {
			error_message = `<span class="${msg_class}">${__(message)}</span><br>${
				field?.description
			}`;
		} else {
			error_message = `<span class="${msg_class}">${__(message)}</span>`;
		}
		if (toggle) {
			context.set_df_property(fieldname, "description", error_message);
			$(field.$wrapper).addClass(`has-${msg_type}`);
			if (reqd) {
				frappe.validate = false;
				throw new Error(message);
			}
		} else {
			if (field?.description) {
				context.set_df_property(fieldname, "description", field?.description);
			} else {
				context.set_df_property(fieldname, "description", "");
			}
			$(field.$wrapper).removeClass(`has-${msg_type}`);
			frappe.validate = true;
		}
	} else {
		if (toggle) {
			const isDialog = context?.$wrapper && context.get_value;
			const isForm = context?.fields_dict && context.doc;

			// Show error message
			if (isDialog && context?.show_message) {
				if (context?.header) {
					const $header = $(context.header);
					// remove existing error message if present
					$header.find("#sva-dt-error-message").remove();
					// append fresh error message with dynamic styling
					$header.append(`
						<div id="sva-dt-error-message" class="form-message border-bottom ${msg_class}" style="display: flex; align-items: center; gap: 4px; margin-top: 4px; padding: 0px 10px; background: ${
						msg_styles.background
					}; border-left: 3px solid ${
						msg_styles.borderColor
					}; border-radius: 4px; font-size: 13px; color: ${
						msg_styles.textColor
					}; animation: slideDown 0.3s ease;">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="color: ${
								msg_styles.iconColor
							}; flex-shrink: 0;">
								<path d="${icon_path}"/>
							</svg>
							<div class="form-message border-bottom ${msg_class}">${__(message)}</div>
						</div>
					`);
				} else {
					context.show_message("");
					context.show_message(__(message), msg_class);
				}
				if (reqd) {
					frappe.validate = false;
					throw new Error(message);
				}
			} else if (isForm) {
				frappe.throw(message);
			}
		} else {
			const isDialog = context?.$wrapper && context.get_value;
			if (isDialog && context?.show_message) {
				if (context?.header) {
					const $header = $(context.header);
					// remove existing error message if present
					$header.find("#sva-dt-error-message").remove();
				} else {
					context.show_message("");
				}
			}
		}
	}
}

frappe.utils.toggleFieldError = toggleFieldError;

function makeDialogFullScreen(dialog) {
	// Write logic to ensure that the dialog is full screen
	let dbody = $(dialog.$wrapper).find(".modal-dialog");
	let dbody_content = $(dialog.$wrapper).find(".modal-content");
	dbody?.css({
		"min-width": "100%",
		width: "100%",
		"max-width": "100%",
		margin: "0",
		padding: "0",
	});
	dbody_content?.css({
		"min-height": "100vh",
		height: "100vh !important",
		"border-radius": "0",
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

function makePopover(el, title, content, placement = "left", trigger = "hover") {
	// Handle case where only title is available
	let popoverContent = content;
	let popoverTitle = title;

	if (!content && title) {
		// If only title is provided, use it as content and create a styled title
		popoverContent = title;
		popoverTitle = "Info : ";
	} else if (!title && content) {
		// If only content is provided, create a default title
		popoverTitle = "Information : ";
	} else if (!title && !content) {
		// If neither is provided, don't create popover
		return;
	}

	// Set popover attributes
	el.setAttribute("data-toggle", "popover");
	el.setAttribute("data-content", popoverContent);
	el.setAttribute("data-placement", placement);
	el.setAttribute("data-trigger", trigger);
	el.setAttribute("data-html", "true");
	el.setAttribute("data-container", "body");
	el.setAttribute("data-delay", "100");
	el.setAttribute("data-offset", "10,10");
	el.setAttribute("title", popoverTitle);
	// Initialize Bootstrap popover
	$(el).popover();
}

frappe.utils.make_popover = makePopover;

// Download Template
async function downloadTemplate(api_method, is_existing_file = false, is_download = true) {
	try {
		if (is_existing_file) {
			if (api_method) {
				let a = document.createElement("a");
				let fileName = api_method.split("/").pop();

				a.href = api_method;
				a.download = fileName;

				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			} else {
				console.error("file path is not provided");
				return;
			}
		} else {
			frappe.dom.freeze();
			let response = await fetch(`/api/method/${api_method}`);
			if (!response.ok) {
				let error = await response.json();
				const safeError = JSON.stringify(error).replace(/[\r\n]/g, " ");
				console.error("Error downloading template", safeError);
				frappe.msgprint(error.message || frappe.utils.messages.get("generate_mou"));
				return;
			}

			if (is_download) {
				let blob = await response.blob();
				let url = window.URL.createObjectURL(blob);
				let a = document.createElement("a");
				a.href = url;
				let contentDisposition = response.headers.get("Content-Disposition");
				let today = frappe.datetime.get_today();
				let [year, month, day] = today.split("-");
				let todayFormatted = `${day}-${month}-${year}`;
				let fileName = `mgrant_document_${todayFormatted}`;
				if (contentDisposition && contentDisposition.includes("filename=")) {
					fileName = contentDisposition.split("filename=")[1].replace(/["']/g, "");
				}
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
			} else {
				let blob = await response.blob();
				let url = window.URL.createObjectURL(blob);
				window.open(url, "_blank");
				setTimeout(() => window.URL.revokeObjectURL(url), 5000);
			}
		}
	} catch (error) {
		console.error("Error downloading template", error);
		frappe.msgprint(error.message || frappe.utils.messages.get("generate_mou"));
		return;
	} finally {
		frappe.dom.unfreeze();
	}
}
frappe.utils.download_template = downloadTemplate;

const setup_year_options_on_autocomplete_field = (frm, fieldname) => {
	try {
		let currentYear = new Date().getFullYear();
		let years = Array.from({ length: currentYear - 1899 }, (_, i) => (1900 + i).toString());
		frm.fields_dict[fieldname].set_data(years);
		frm.refresh_field(fieldname);
	} catch (error) {
		console.error(error);
	}
};
frappe.utils.setup_year_options_on_autocomplete_field = setup_year_options_on_autocomplete_field;

function getLighterShade(hex, percent = 20) {
	// Remove the hash if present
	hex = hex.replace(/^#/, "");

	// Parse the hex color
	let r = parseInt(hex.substring(0, 2), 16);
	let g = parseInt(hex.substring(2, 4), 16);
	let b = parseInt(hex.substring(4, 6), 16);

	// Calculate the lighter shade
	r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
	g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
	b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

	// Convert back to hex
	const toHex = (n) => n.toString(16).padStart(2, "0");

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
frappe.utils.get_lighter_shade_of_hex_color = getLighterShade;

function getDialogSize(fields) {
	let hasChildTable = fields.some((field) => field.fieldtype === "Table");
	let hasMultipleColumns = false;

	let currentColumnCount = 0; // Track columns in a section
	for (let field of fields) {
		if (field.fieldtype === "Section Break") {
			currentColumnCount = 0; // Reset column count on new section
		} else if (field.fieldtype === "Column Break") {
			currentColumnCount++; // Increase column count
		}

		if (currentColumnCount >= 1) {
			// At least one column break = 2 columns
			hasMultipleColumns = true;
		}
	}

	if (hasChildTable) {
		return "extra-large"; // Child tables require more space
	} else if (hasMultipleColumns) {
		return "large"; // Sections with 2+ columns need a larger dialog
	} else {
		return "small"; // Default size
	}
}

frappe.utils.get_dialog_size = getDialogSize;
