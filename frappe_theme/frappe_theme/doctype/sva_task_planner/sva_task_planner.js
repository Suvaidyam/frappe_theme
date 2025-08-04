// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

function set_day_options(frm) {
    const day_options_by_frequency = {
        "Monthly": [
            "Start of the month", "End of the month",
            2, 3, 4, 5, 6, 7, 8, 9, 10,
            11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
            21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
        ],
        "Quarterly": [
            "Start of the Quarter", "End of the Quarter"
        ],
        "Weekly": [
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
        ],
        "Fortnightly": [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ],
        "Annually": [
            "Start of the year", "End of the year"
        ],
        "Bi-Annually": [
            "Start of the Bi-Annual Period", "End of the Bi-Annual Period"
        ]
    };

    const options = day_options_by_frequency[frm.doc.frequency] || day_options_by_frequency["Monthly"];
    frm.set_df_property("day", "options", options);

    frm.set_query("parent_task_name", () => ({
        filters: {
            is_group: 1
        }
    }));
}

frappe.ui.form.on("SVA Task Planner", {
    refresh(frm) {
        set_day_options(frm);
    },
    frequency(frm) {
        set_day_options(frm);
    }
});
