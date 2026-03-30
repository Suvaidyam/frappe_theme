const PaginationMixin = {
	setupPageSizeControl() {
		const existing = this.wrapper?.querySelector("#sva-dt-page-size-wrap");
		if (existing) {
			this.pageSizeButtons = Array.from(
				existing.querySelectorAll("button.sva-dt-page-size-btn")
			);
			this.pageSizeButtons.forEach((btn) => {
				const n = parseInt(btn.dataset.value, 10);
				const isActive = n === this.limit;
				btn.classList.toggle("btn-secondary", !isActive);
				btn.classList.toggle("btn-light", isActive);
				btn.classList.toggle("active", isActive);
				btn.style.backgroundColor = isActive ? "#fff" : "";
				btn.style.color = isActive ? "#212529" : "";
				btn.style.borderColor = isActive ? "#ced4da" : "";
			});
			return existing;
		}

		// Requirement: show only 10 / 20 / 50
		const allowedChoices = [10, 20, 50];
		const allowedSet = new Set(allowedChoices);
		const rawChoices = Array.isArray(this._pageLengthChoices) ? this._pageLengthChoices : null;
		const choices = rawChoices
			? rawChoices.map(Number).filter((n) => allowedSet.has(n))
			: allowedChoices;
		const finalChoices = choices.length ? choices : allowedChoices;

		const pageSizeWrap = document.createElement("div");
		pageSizeWrap.id = "sva-dt-page-size-wrap";
		pageSizeWrap.classList.add("sva-dt-page-size");
		pageSizeWrap.style.cssText =
			"display:flex;align-items:center;justify-content:flex-end;white-space:nowrap;font-size:12px;height:32px;";

		const btnGroup = document.createElement("div");
		btnGroup.classList.add("btn-group");
		btnGroup.setAttribute("role", "group");
		btnGroup.style.cssText = "gap:0;border-radius:7px;border:1px solid #e5e4e4;";

		const buttons = [];
		this._updatePageSizeButtonActive = () => {
			if (!Array.isArray(this.pageSizeButtons)) return;
			this.pageSizeButtons.forEach((btn) => {
				const n = parseInt(btn.dataset.value, 10);
				const isActive = n === this.limit;
				// Make active look like a white pill/button (per screenshot)
				btn.classList.toggle("btn-secondary", !isActive);
				btn.classList.toggle("btn-light", isActive);
				btn.classList.toggle("active", isActive);
				btn.style.backgroundColor = isActive ? "#fff" : "";
				btn.style.color = isActive ? "#212529" : "";
				btn.style.borderColor = isActive ? "#ced4da" : "";
			});
		};

		for (const n of finalChoices) {
			const pageSizeBtn = document.createElement("button");
			pageSizeBtn.type = "button";
			pageSizeBtn.classList.add("btn", "btn-sm", "sva-dt-page-size-btn");
			pageSizeBtn.dataset.value = String(n);
			pageSizeBtn.textContent = String(n);
			pageSizeBtn.style.cssText =
				"padding:0 10px;height:32px;line-height:32px;border-width:1px;";
			// Rounded corners only at group edges (Bootstrap usually handles this,
			// but our buttons are created dynamically).
			if (buttons.length === 0) {
				pageSizeBtn.style.borderTopLeftRadius = "7px";
				pageSizeBtn.style.borderBottomLeftRadius = "7px";
			} else if (buttons.length === finalChoices.length - 1) {
				pageSizeBtn.style.borderTopRightRadius = "7px";
				pageSizeBtn.style.borderBottomRightRadius = "7px";
			}
			pageSizeBtn.addEventListener("click", async () => {
				const next = parseInt(pageSizeBtn.dataset.value, 10);
				if (!Number.isFinite(next) || next <= 0 || !finalChoices.includes(next)) return;
				if (next === this.limit) return;
				const prevLimit = this.limit;
				this.limit = next;
				this.page = 1;
				this._updatePageSizeButtonActive?.();
				this.rows = await this.getDocList();
				this.updateTableBody();
				if (this.pageButtonsContainer) {
					this.updatePageButtons();
				}
			});
			buttons.push(pageSizeBtn);
			btnGroup.appendChild(pageSizeBtn);
		}

		this.pageSizeButtons = buttons;
		pageSizeWrap.appendChild(btnGroup);
		this._updatePageSizeButtonActive();
		return pageSizeWrap;
	},

	setupPagination() {
		let pagination = document.createElement("div");
		pagination.id = "pagination-element";
		pagination.setAttribute("aria-label", "Page navigation");
		pagination.style.cssText =
			"display:flex;align-items:center;font-size:12px !important;min-height:32px;";

		let paginationList = document.createElement("ul");
		paginationList.classList.add("pagination", "justify-content-center");
		paginationList.style.cssText = "margin:0;align-items:center;";

		// First button
		let firstBtnItem = document.createElement("li");
		firstBtnItem.id = "firstBtnItem";
		firstBtnItem.classList.add("page-item");
		let firstBtn = document.createElement("button");
		firstBtn.classList.add("page-link");
		firstBtn.textContent = "<<";
		firstBtn.addEventListener("click", async () => {
			if (this.page > 1) {
				this.page = 1;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		firstBtnItem.appendChild(firstBtn);
		paginationList.appendChild(firstBtnItem);

		// Previous button
		let prevBtnItem = document.createElement("li");
		prevBtnItem.id = "prevBtnItem";
		prevBtnItem.classList.add("page-item");
		let prevBtn = document.createElement("button");
		prevBtn.classList.add("page-link");
		prevBtn.textContent = "<";
		prevBtn.addEventListener("click", async () => {
			if (this.page > 1) {
				this.page -= 1;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		prevBtnItem.appendChild(prevBtn);
		paginationList.appendChild(prevBtnItem);

		// Page numbers container
		this.pageButtonsContainer = paginationList;
		this.updatePageButtons();

		// Next button
		let nextBtnItem = document.createElement("li");
		nextBtnItem.id = "nextBtnItem";
		nextBtnItem.classList.add("page-item");
		let nextBtn = document.createElement("button");
		nextBtn.classList.add("page-link");
		nextBtn.textContent = ">";
		nextBtn.addEventListener("click", async () => {
			if (this.page < Math.ceil(this.total / this.limit)) {
				this.page += 1;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		nextBtnItem.appendChild(nextBtn);
		paginationList.appendChild(nextBtnItem);

		// Last button
		let lastBtnItem = document.createElement("li");
		lastBtnItem.id = "lastBtnItem";
		lastBtnItem.classList.add("page-item");
		let lastBtn = document.createElement("button");
		lastBtn.classList.add("page-link");
		lastBtn.textContent = ">>";
		lastBtn.addEventListener("click", async () => {
			let lastPage = Math.ceil(this.total / this.limit);
			if (this.page < lastPage) {
				this.page = lastPage;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		lastBtnItem.appendChild(lastBtn);
		paginationList.appendChild(lastBtnItem);

		pagination.appendChild(paginationList);
		return pagination;
	},

	updatePageButtons() {
		if (!this.pageButtonsContainer) {
			return;
		}

		// Clear existing page buttons (except first, prev, next, last)
		this.pageButtonsContainer
			.querySelectorAll(
				".page-item:not(#firstBtnItem):not(#prevBtnItem):not(#nextBtnItem):not(#lastBtnItem)"
			)
			.forEach((el) => el.remove());

		// Update button states
		let totalPages = Math.ceil(this.total / this.limit);
		// Keep the active page-size button highlighted.
		if (Array.isArray(this.pageSizeButtons)) {
			this._updatePageSizeButtonActive?.();
		}

		// First button state
		if (this.page === 1) {
			this.pageButtonsContainer.querySelector("#firstBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#firstBtnItem")?.classList.remove("disabled");
		}

		// Previous button state
		if (this.page === 1) {
			this.pageButtonsContainer.querySelector("#prevBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#prevBtnItem")?.classList.remove("disabled");
		}

		// Next button state
		if (this.page === totalPages) {
			this.pageButtonsContainer.querySelector("#nextBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#nextBtnItem")?.classList.remove("disabled");
		}

		// Last button state
		if (this.page === totalPages) {
			this.pageButtonsContainer.querySelector("#lastBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#lastBtnItem")?.classList.remove("disabled");
		}

		let currentPage = this.page;
		let pagesToShow = [];

		// Always show first page
		pagesToShow.push(1);

		// Calculate range around current page
		let startPage = Math.max(2, currentPage - 1);
		let endPage = Math.min(totalPages - 1, currentPage + 1);

		// Add pages around current page
		if (startPage > 2) {
			pagesToShow.push("...");
		}
		for (let i = startPage; i <= endPage; i++) {
			pagesToShow.push(i);
		}
		if (endPage < totalPages - 1) {
			pagesToShow.push("...");
		}

		// Always show last page if there is more than one page
		if (totalPages > 1) {
			pagesToShow.push(totalPages);
		}

		// Create page buttons
		pagesToShow.forEach((pageNum) => {
			let pageItem = document.createElement("li");
			pageItem.classList.add("page-item");
			if (pageNum === "...") {
				pageItem.classList.add("disabled");
				let ellipsis = document.createElement("span");
				ellipsis.classList.add("page-link");
				ellipsis.textContent = "...";
				pageItem.appendChild(ellipsis);
			} else {
				if (pageNum === currentPage) {
					pageItem.classList.add("active");
				}
				let pageBtn = document.createElement("button");
				pageBtn.classList.add("page-link");
				pageBtn.textContent = pageNum;
				pageBtn.addEventListener("click", async () => {
					if (pageNum !== currentPage) {
						this.page = pageNum;
						this.rows = await this.getDocList();
						this.updateTableBody();
						this.updatePageButtons();
					}
				});
				pageItem.appendChild(pageBtn);
			}

			// Insert before the Next button
			this.pageButtonsContainer.insertBefore(
				pageItem,
				this.pageButtonsContainer.querySelector("#nextBtnItem")
			);
		});
	},
};

export default PaginationMixin;
