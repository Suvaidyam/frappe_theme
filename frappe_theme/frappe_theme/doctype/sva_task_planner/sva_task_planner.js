// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt
function setDayOptions(frm) {
    frm.set_query("parent_task_name", function () {
        return {
            filters: {
                "is_group": 1
            }
        };
    });
    monthly_dates = [
        "",
        "Start of the month",
        "End of the month",
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
    ]
    quarterly_dates = ["", "Start of the month", "End of the month"]

    if (frm.doc.frequency === "Quarterly") {
        frm.set_df_property("day", "options", quarterly_dates);
    } else {
        frm.set_df_property("day", "options", monthly_dates);
    }
}

frappe.ui.form.on("SVA Task Planner", {
    refresh(frm) {
        setDayOptions(frm);
    },
    frequency(frm) {
        setDayOptions(frm);
    }
});

