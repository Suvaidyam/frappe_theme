const PaginationMixin = {
	setupPagination() {
		let pagination = document.createElement("div");
		pagination.id = "pagination-element";
		pagination.setAttribute("aria-label", "Page navigation");
		pagination.setAttribute("style", "font-size:12px !important;height:30px !important;");

		let paginationList = document.createElement("ul");
		paginationList.classList.add("pagination", "justify-content-center");

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
		// Clear existing page buttons (except first, prev, next, last)
		this.pageButtonsContainer
			.querySelectorAll(
				".page-item:not(#firstBtnItem):not(#prevBtnItem):not(#nextBtnItem):not(#lastBtnItem)"
			)
			.forEach((el) => el.remove());

		// Update button states
		let totalPages = Math.ceil(this.total / this.limit);

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
