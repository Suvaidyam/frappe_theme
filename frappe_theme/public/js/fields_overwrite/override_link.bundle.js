frappe.ui.form.ControlLink = class ControlLinkWithIcon extends frappe.ui.form.ControlLink {
	make_input() {
		super.make_input();
		if (this?.frm?.meta?.issingle && this.frm?.meta?.is_dashboard) {
			this.df.only_select = true;
			const is_xs_input = this.df.input_class && this.df.input_class.includes("input-xs");
			this.set_icon(is_xs_input);
			this.df.placeholder && this.set_placeholder(is_xs_input);
			this.$input.addClass("ellipsis");
		}
	}
	set_icon(is_xs_input) {
		const select_icon_html = `<div style="position:absolute; right: 8px; top: 47%; transform: translateY(-50%)" class="select-icon ${
			is_xs_input ? "xs" : ""
		}">
				${frappe.utils.icon("select", is_xs_input ? "xs" : "sm")}
			</div>`;

		this.$wrapper.find(".form-control").css({
			"background-color": "white",
			outline: "none",
			border: "1px solid #dcdcdc",
			"border-radius": "6px",
			"box-shadow": "none",
			"padding-right": "0px",
			cursor: "pointer",
		});
		this.$wrapper.find("div.clearfix").remove();
		this.$wrapper
			.find(".control-input-wrapper")
			.css({ "background-color": "white", border: "none", position: "relative" })
			.append(select_icon_html);
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
};
