frappe.ui.form.ControlSelect = class ControlSelectWithIcon extends frappe.ui.form.ControlSelect {
	make_input() {
		super.make_input();
		if (this?.frm?.meta?.issingle && this.frm?.meta?.is_dashboard) {
			this.$wrapper.find(".form-control").css({
				"background-color": "white",
				outline: "none",
				border: "1px solid #dcdcdc",
				"border-radius": "6px",
				"box-shadow": "none",
				"padding-right": "28px",
				appearance: "none", // 🔥 native arrow hide
			});
			this.$wrapper.find("div.clearfix").remove();
		}
	}
};
