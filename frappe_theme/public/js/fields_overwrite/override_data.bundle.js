frappe.ui.form.ControlData = class SVAControlData extends frappe.ui.form.ControlData {
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
            const is_xs_input = this.df.input_class && this.df.input_class.includes("input-xs");
            this.df.placeholder && this.set_placeholder(is_xs_input);
		}
	}
    set_placeholder() {
		this.$wrapper.find(".form-control").attr("placeholder", this.df.placeholder);
		this.toggle_placeholder();
		this.$input && this.$input.on("select-change", () => this.toggle_placeholder());
	}
    toggle_placeholder() {
		const input_set = Boolean(this.$input.val());
		if (input_set) {
			this.$wrapper.find(".form-control").attr("placeholder", "");
		} else {
			this.$wrapper.find(".form-control").attr("placeholder", this.df.placeholder);
		}
	}
}