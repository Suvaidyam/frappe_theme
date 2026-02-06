frappe.ui.form.ControlButton = class ControlButtonWithIcon extends frappe.ui.form.ControlButton {
	make_input() {
		if (this.frm?.meta?.is_dashboard && this.df?.is_apply_button) {
			// Remove label area
			this.$wrapper.find("div.clearfix").remove();
			this.$wrapper.css({
				display: "flex",
				"align-items": "center",
				gap: "8px",
				"justify-content": "flex-end",
			});

			let apply_button = document.createElement("button");
			apply_button.className = "btn btn-secondary btn-sm";
			apply_button.id = "sva-dt-filter-apply_button";
			apply_button.innerText = __("Apply");
			this.$apply_button = $(apply_button);
			this.$apply_button.on("click", async () => {
				if (this.apply_action) {
					await this.apply_action();
				}
			});
			if (!this.$wrapper.find("#sva-dt-filter-apply_button").length) {
				this.$wrapper.append(apply_button);
			}

			let reset_button = document.createElement("button");
			reset_button.className = "btn btn-secondary btn-sm";
			reset_button.id = "sva-dt-filter-reset_button";
			reset_button.innerText = __("Reset");
			this.$reset_button = $(reset_button);
			this.$reset_button.on("click", async () => {
				if (this.reset_action) {
					await this.reset_action();
				}
			});
			if (!this.$wrapper.find("#sva-dt-filter-reset_button").length) {
				this.$wrapper.append(reset_button);
			}
		} else {
			super.make_input();
		}
	}
};
