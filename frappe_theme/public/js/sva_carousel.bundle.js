function getColumnsFromUI(fieldname, frm) {
	const field = frm.fields_dict[fieldname];
	if (!field?.wrapper) return 1;
	const section = field.wrapper.closest(".form-section");
	if (!section) return 1;
	return section.querySelectorAll(".form-column").length || 1;
}

/* ================= Media Detection ================= */
function getMediaType(url) {
	if (!url) return "image";
	const lower = url.toLowerCase();
	const videoExt = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"];
	return videoExt.some((ext) => lower.includes(ext)) ||
		lower.includes("youtube.com") ||
		lower.includes("youtu.be") ||
		lower.includes("vimeo.com")
		? "video"
		: "image";
}

function getEmbedUrl(url) {
	if (url.includes("youtube.com/watch?v=")) {
		const id = url.split("v=")[1]?.split("&")[0];
		return `https://www.youtube.com/embed/${id}?autoplay=0&mute=0`;
	}
	if (url.includes("youtu.be/")) {
		const id = url.split("youtu.be/")[1]?.split("?")[0];
		return `https://www.youtube.com/embed/${id}?autoplay=0&mute=0`;
	}
	if (url.includes("vimeo.com/")) {
		const id = url.split("vimeo.com/")[1]?.split("/")[0];
		return `https://player.vimeo.com/video/${id}`;
	}
	return url;
}

/* ================= Configuration ================= */
const responsiveConfig = {
	"mobile-small": {
		carouselHeight: 450,
		imgHeight: "270px",
		titleFontSize: 16,
		descFontSize: 12,
		contentPadding: "8px 12px",
		navButtonSize: "32px",
		navIconSize: "18px",
		navButtonPosition: "8px",
		bulletSize: "7px",
		indicatorOffset: "12px",
		bulletGap: "8px",
		pageCounterFontSize: "13px",
		pageCounterPadding: "4px 8px",
	},
	mobile: {
		carouselHeight: 450,
		imgHeight: "270px",
		titleFontSize: 18,
		descFontSize: 13,
		contentPadding: "10px 16px",
		navButtonSize: "36px",
		navIconSize: "20px",
		navButtonPosition: "10px",
		bulletSize: "8px",
		indicatorOffset: "15px",
		bulletGap: "10px",
		pageCounterFontSize: "14px",
		pageCounterPadding: "4px 10px",
	},
	tablet: {
		carouselHeight: 450,
		imgHeight: "none",
		titleFontSize: 20,
		descFontSize: 16,
		contentPadding: "24px 32px",
		navButtonSize: "42px",
		navIconSize: "22px",
		navButtonPosition: "15px",
		bulletSize: "9px",
		indicatorOffset: "25px",
		bulletGap: "12px",
		pageCounterFontSize: "15px",
		pageCounterPadding: "6px 12px",
	},
	desktop: {
		carouselHeight: 450,
		imgHeight: "none",
		titleFontSize: 24,
		descFontSize: 18,
		contentPadding: "30px 40px",
		navButtonSize: "48px",
		navIconSize: "24px",
		navButtonPosition: "20px",
		bulletSize: "10px",
		indicatorOffset: "30px",
		bulletGap: "14px",
		pageCounterFontSize: "16px",
		pageCounterPadding: "6px 14px",
	},
	"desktop-large": {
		carouselHeight: 450,
		imgHeight: "none",
		titleFontSize: 26,
		descFontSize: 20,
		contentPadding: "36px 48px",
		navButtonSize: "52px",
		navIconSize: "26px",
		navButtonPosition: "24px",
		bulletSize: "11px",
		indicatorOffset: "35px",
		bulletGap: "16px",
		pageCounterFontSize: "18px",
		pageCounterPadding: "8px 16px",
	},
};

function applyConfigOverrides(config, conf, deviceType) {
	const isMobile = deviceType === "mobile" || deviceType === "mobile-small";
	const multipliers = {
		"mobile-small": 0.65,
		mobile: 0.75,
		tablet: 0.9,
		desktop: 1,
		"desktop-large": 1.1,
	};

	if (conf?.carousel_heightin_px) {
		config.carouselHeight = conf.carousel_heightin_px;
		if (isMobile) {
			config.imgHeight = `${Math.floor(conf.carousel_heightin_px * 0.6)}px`;
		}
	}
	if (conf?.title_font_size) {
		config.titleFontSize = Math.max(
			conf.title_font_size * multipliers[deviceType],
			isMobile ? 14 : 18
		);
	}
	if (conf?.desc_font_size) {
		config.descFontSize = Math.max(
			conf.desc_font_size * (multipliers[deviceType] + 0.05),
			isMobile ? 11 : 14
		);
	}
	return config;
}

/* ================= Position Helper ================= */
function getIndicatorPositionStyles(indicatorPosition, config, isMobile, imgHeight = null) {
	const offset = config.indicatorOffset;
	const positions = {
		"Top Left": { top: offset, left: offset, bottom: "auto", right: "auto" },
		"Top Right": { top: offset, right: offset, bottom: "auto", left: "auto" },
		"Bottom Left": { bottom: offset, left: offset, top: "auto", right: "auto" },
		"Bottom Right": { bottom: offset, right: offset, top: "auto", left: "auto" },
		"Bottom Center": {
			bottom: offset,
			left: "50%",
			top: "auto",
			right: "auto",
			transform: "translateX(-50%)",
		},
	};

	if (isMobile && imgHeight) {
		const imgPx = parseInt(imgHeight);
		const pos = indicatorPosition || "Bottom Center";
		if (pos.includes("Bottom")) {
			positions[pos] = {
				...positions[pos],
				top: `${imgPx - parseInt(offset) - 40}px`,
				bottom: "auto",
			};
		}
	}

	return {
		position: "absolute",
		zIndex: "3",
		transform: "none",
		...positions[indicatorPosition || "Bottom Center"],
	};
}

/* ================= HTML Generator ================= */
function generateMediaHTML(cd) {
	const mediaType = getMediaType(cd.img);
	if (mediaType === "video") {
		const isEmbed =
			cd.img.includes("youtube") || cd.img.includes("vimeo") || cd.img.includes("youtu.be");
		if (isEmbed) {
			const embedUrl = getEmbedUrl(cd.img);
			return `<div class="bg-video"><iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;position:absolute;top:0;left:0;"></iframe></div>
				<div class="img-wrap video-wrap"><iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
		}
		return `<div class="bg-video"><video loop muted playsinline><source src="${cd.img}" type="video/mp4"></video></div>
			<div class="img-wrap video-wrap"><video controls playsinline><source src="${cd.img}" type="video/mp4"></video></div>`;
	}
	return `<div class="bg-image" style="background-image:url('${
		cd.img
	}')"></div><div class="img-wrap"><img src="${cd.img}" alt="${cd.title || ""}"/></div>`;
}

function generateCarouselHTML(data) {
	return `<div class="sva-carousel">
		<button class="nav prev"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
		<div class="viewport"><div class="track">
			${data
				.map(
					(
						cd,
						i
					) => `<div class="container" data-index="${i}" data-media-type="${getMediaType(
						cd.img
					)}">
				${generateMediaHTML(cd)}
				<div class="content-wrapper"><div class="content">
					${cd.title ? `<h3 class="title">${cd.title}</h3>` : ""}
					${cd.description ? `<p class="desc">${cd.description}</p>` : ""}
				</div></div>
			</div>`
				)
				.join("")}
		</div></div>
		<div class="bullets">${data
			.map((_, i) => `<span class="bullet" data-index="${i}"></span>`)
			.join("")}</div>
		<div class="page-counter"><span class="current">1</span> of <span class="total">${
			data.length
		}</span></div>
		<button class="nav next"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
	</div>`;
}

/* ================= Styling ================= */
function applyStyles(
	carousel,
	viewport,
	track,
	containers,
	wrapper,
	conf,
	config,
	isMobile,
	isMobileSmall,
	isTablet,
	currentIndex
) {
	Object.assign(carousel.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		position: "relative",
		minHeight: `${config.carouselHeight}px`,
		maxWidth: "100%",
		margin: "0 auto",
		overflow: "hidden",
	});
	Object.assign(viewport.style, {
		width: "100%",
		height: `${config.carouselHeight}px`,
		overflow: "hidden",
		position: "relative",
		touchAction: "pan-y pinch-zoom",
	});
	Object.assign(track.style, {
		display: "flex",
		transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
		willChange: "transform",
		height: "100%",
	});

	containers.each((idx, container) => {
		const isVideo = container.getAttribute("data-media-type") === "video";
		const bg = container.querySelector(".bg-image, .bg-video");
		const cw = container.querySelector(".content-wrapper");
		const mw = container.querySelector(".img-wrap, .video-wrap");
		const me = isVideo
			? mw?.querySelector("video") || mw?.querySelector("iframe")
			: mw?.querySelector("img");
		const c = container.querySelector(".content");
		const t = container.querySelector(".title");
		const d = container.querySelector(".desc");

		Object.assign(container.style, {
			minWidth: "100%",
			width: "100%",
			height: `${config.carouselHeight}px`,
			position: "relative",
			background: isMobile ? "#fff" : "#f5f5f5",
			borderRadius: "0",
			boxShadow: "none",
			padding: "0",
			boxSizing: "border-box",
			display: isMobile ? "flex" : "block",
			flexDirection: isMobile ? "column" : "initial",
		});

		if (isMobile) {
			if (bg) bg.style.display = "none";
			Object.assign(cw.style, {
				position: "relative",
				background: "transparent",
				padding: "0",
				borderRadius: "0",
				height: "100%",
				display: "flex",
				flexDirection: "column",
			});
			// Mobile view section mein (around line 268)
			if (mw)
				Object.assign(mw.style, {
					height: config.imgHeight,
					width: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					overflow: "hidden",
					borderRadius: "0",
					marginBottom: "0",
					flexShrink: "0",
					position: "relative",
				});
			if (me) {
				Object.assign(me.style, {
					width: "100%",
					height: "100%",
					objectFit: "cover",
					display: "block",
				});

				// Hide controls for video
				if (isVideo && me.tagName === "VIDEO") {
					me.removeAttribute("controls");
					me.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback");
					me.setAttribute("disablePictureInPicture", "true");
				}
			}
			if (c) {
				const imgHeightPx = parseInt(config.imgHeight);
				const remainingHeight = 450 - imgHeightPx;

				Object.assign(c.style, {
					textAlign: "center",
					fontFamily: conf?.font_family || "system-ui",
					color: "#333",
					padding: isMobileSmall ? "8px 12px" : "10px 16px",
					overflow: "auto",
					flex: "1",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-start",
					alignItems: "stretch",
					height: `${remainingHeight}px`,
					maxHeight: `${remainingHeight}px`,
					minHeight: `${remainingHeight}px`,
				});
			}
			if (t) {
				Object.assign(t.style, {
					color: conf?.title_color || "#1a1a1a",
					background: "transparent",
					textAlign: conf?.alignment || "center",
					fontFamily: conf?.font_family || "system-ui",
					fontSize: `${config.titleFontSize}px`,
					fontWeight: "600",
					marginBottom: "6px",
					padding: "0",
					borderRadius: "0",
					lineHeight: "1.3",
					wordWrap: "break-word",
					width: "100%",
					flexShrink: "0",
					display: "block",
				});
			}
			if (d) {
				Object.assign(d.style, {
					color: conf?.desc_color || "#4a4a4a",
					background: "transparent",
					textAlign: conf?.alignment || "center",
					fontFamily: conf?.font_family || "system-ui",
					fontSize: `${config.descFontSize}px`,
					fontWeight: "400",
					lineHeight: isMobileSmall ? "1.4" : "1.5",
					padding: "0",
					margin: "0",
					borderRadius: "0",
					wordWrap: "break-word",
					overflowWrap: "break-word",
					width: "100%",
					overflow: "auto",
					flex: "1",
					display: "block",
				});
			}
		} else {
			if (bg) {
				Object.assign(bg.style, {
					display: "block",
					position: "absolute",
					top: "0",
					left: "0",
					width: "100%",
					height: "100%",
					zIndex: "1",
					filter: "brightness(0.7)",
				});
				if (isVideo) {
					const v = bg.querySelector("video") || bg.querySelector("iframe");
					if (v)
						Object.assign(v.style, {
							width: "100%",
							height: "100%",
							objectFit: "cover",
						});
				} else {
					Object.assign(bg.style, {
						backgroundSize: "cover",
						backgroundPosition: "center",
						backgroundRepeat: "no-repeat",
					});
				}
			}
			Object.assign(cw.style, {
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				zIndex: "2",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				maxWidth: isTablet ? "85%" : "90%",
				width: isTablet ? "85%" : "90%",
				maxHeight: "85%",
				padding: "0",
			});
			if (mw) mw.style.display = "none";
			if (c) {
				Object.assign(c.style, {
					textAlign: conf?.alignment || "left",
					fontFamily: conf?.font_family || "system-ui",
					color: conf?.text_color || "#fff",
					width: "100%",
					maxHeight: "100%",
					overflowY: "auto",
					overflowX: "hidden",
					padding: config.contentPadding,
					borderRadius: "8px",
					scrollbarWidth: "thin",
					scrollbarColor: "rgba(255,255,255,0.5) transparent",
					boxSizing: "border-box",
				});
			}
			if (t) {
				Object.assign(t.style, {
					color: conf?.title_color || "#fff",
					background: "transparent",
					textAlign: conf?.alignment || "left",
					fontFamily: conf?.font_family || "system-ui",
					fontSize: `${config.titleFontSize}px`,
					fontWeight: "600",
					marginBottom: isTablet ? "14px" : "16px",
					textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
					padding: isTablet ? "8px 10px" : "10px",
					borderRadius: "5px",
					lineHeight: "1.3",
					wordWrap: "break-word",
				});
			}
			if (d) {
				Object.assign(d.style, {
					color: conf?.desc_color || "#fff",
					background: "transparent",
					textAlign: conf?.alignment || "left",
					fontFamily: conf?.font_family || "system-ui",
					fontSize: `${config.descFontSize}px`,
					fontWeight: "400",
					lineHeight: "1.6",
					textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
					padding: isTablet ? "8px 10px" : "10px",
					borderRadius: "5px",
					wordWrap: "break-word",
				});
			}
		}
	});

	// Navigation
	const navTop = isMobile ? `calc(${config.imgHeight} / 2)` : "50%";
	wrapper.find(".nav").each(function () {
		Object.assign(this.style, {
			border: "none",
			position: "absolute",
			top: navTop,
			transform: "translateY(-50%)",
			background: conf?.slider_button_bg || "rgba(255,255,255,0.9)",
			opacity: isMobile ? "0.7" : "0.3",
			width: config.navButtonSize,
			height: config.navButtonSize,
			borderRadius: "50%",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
			zIndex: "3",
			transition: "all 0.3s ease",
			flexShrink: "0",
		});
		this.addEventListener("mouseenter", () =>
			Object.assign(this.style, {
				background: conf?.slider_button_bg || "rgba(255,255,255,1)",
				transform: "translateY(-50%) scale(1.1)",
				opacity: "1",
				boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
			})
		);
		this.addEventListener("mouseleave", () =>
			Object.assign(this.style, {
				background: conf?.slider_button_bg || "rgba(255,255,255,0.9)",
				transform: "translateY(-50%) scale(1)",
				opacity: isMobile ? "0.7" : "0.3",
				boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
			})
		);
	});
	wrapper.find(".prev")[0].style.left = config.navButtonPosition;
	wrapper.find(".next")[0].style.right = config.navButtonPosition;
	wrapper.find(".nav svg").each(function () {
		Object.assign(this.style, {
			color: conf?.slider_button_color || "#111",
			width: config.navIconSize,
			height: config.navIconSize,
			flexShrink: "0",
		});
	});

	// Indicators
	const indicatorType = conf?.bullet_indicator_type || "Bullets";
	const indicatorPosition = conf?.indicator_position || "Bottom Center";
	const isDark = (conf?.indicator_style || "Light").toLowerCase() === "dark";
	const containerBg = isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)";
	const bulletColor = "#fff";
	const bulletInactive = isDark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.5)";

	const bulletsContainer = wrapper.find(".bullets")[0];
	if (bulletsContainer) {
		if (indicatorType.toLowerCase().includes("bullet")) {
			bulletsContainer.style.display = "flex";
			Object.assign(bulletsContainer.style, {
				...getIndicatorPositionStyles(
					indicatorPosition,
					config,
					isMobile,
					isMobile ? config.imgHeight : null
				),
				display: "flex",
				gap: config.bulletGap,
				flexWrap: "wrap",
				justifyContent: "center",
				alignItems: "center",
				padding: config.pageCounterPadding,
				background: containerBg,
				borderRadius: "12px",
				backdropFilter: "blur(4px)",
			});
		} else {
			bulletsContainer.style.display = "none";
		}
	}

	wrapper.find(".bullet").each(function (idx) {
		const isActive = idx === currentIndex;
		Object.assign(this.style, {
			width: config.bulletSize,
			height: config.bulletSize,
			borderRadius: "50%",
			background: isActive ? bulletColor : bulletInactive,
			cursor: "pointer",
			transition: "all 0.3s ease",
			border: "2px solid transparent",
			flexShrink: "0",
			transform: isActive ? "scale(1.3)" : "scale(1)",
			boxShadow: isActive
				? isDark
					? "0 0 10px rgba(255,255,255,0.9)"
					: "0 0 10px rgba(255,255,255,0.8)"
				: "none",
		});
	});

	const pageCounter = wrapper.find(".page-counter")[0];
	if (pageCounter) {
		const showCounter =
			indicatorType.toLowerCase().includes("page") ||
			indicatorType.toLowerCase().includes("counter");
		if (showCounter) {
			pageCounter.style.display = "flex";
			Object.assign(pageCounter.style, {
				...getIndicatorPositionStyles(
					indicatorPosition,
					config,
					isMobile,
					isMobile ? config.imgHeight : null
				),
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: isMobile ? "4px" : "6px",
				padding: config.pageCounterPadding,
				background: containerBg,
				borderRadius: "12px",
				backdropFilter: "blur(4px)",
				color: "#fff",
				fontSize: config.pageCounterFontSize,
				fontWeight: "500",
				fontFamily: conf?.font_family || "system-ui",
				userSelect: "none",
				boxShadow: !isMobile
					? isDark
						? "0 2px 8px rgba(0,0,0,0.4)"
						: "0 2px 8px rgba(0,0,0,0.2)"
					: "none",
			});
			const cur = pageCounter.querySelector(".current");
			if (cur) cur.style.fontWeight = "700";
		} else {
			pageCounter.style.display = "none";
		}
	}

	// Scrollbar style
	if (!document.getElementById("carousel-scroll-style")) {
		const style = document.createElement("style");
		style.id = "carousel-scroll-style";
		style.textContent = `.sva-carousel .content::-webkit-scrollbar{width:6px}.sva-carousel .content::-webkit-scrollbar-track{background:transparent}.sva-carousel .content::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.5);border-radius:3px}.sva-carousel .content::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.7)}`;
		document.head.appendChild(style);
	}
}

/* ================= Video Management ================= */
function pauseAllVideos(container) {
	container.querySelectorAll("video").forEach((v) => {
		if (!v.paused) v.pause();
	});
}

function playCurrentVideo(container, conf) {
	// Background video play karo
	const bgVideo = container.querySelector(".bg-video video");
	if (bgVideo && conf?.auto_play !== false) {
		bgVideo.play().catch((e) => console.log("Video autoplay blocked:", e));
	}

	// Foreground video bhi play karo (mobile view ke liye)
	const fgVideo = container.querySelector(".video-wrap video");
	if (fgVideo && conf?.auto_play !== false) {
		fgVideo.play().catch((e) => console.log("Video autoplay blocked:", e));
	}
}

/* ================= Main Carousel Class ================= */
class SVACarousel {
	constructor({ wrapper, conf, html_field, frm }) {
		this.wrapper = wrapper;
		this.conf = conf;
		this.data = [];
		this.currentIndex = 0;
		this.interval = null;
		this.touchStartX = 0;
		this.touchEndX = 0;
		this.forceCardLayout = getColumnsFromUI(html_field, frm) >= 3;

		// Check if report data should be used
		if (conf.is_report && conf.link_report) {
			this.loadReportData(conf.link_report);
		} else {
			this.data = conf?.carousel || [];
			this.init();
		}
	}

	loadReportData(reportName) {
		frappe.call({
			method: "frappe.desk.query_report.run",
			args: {
				report_name: reportName,
				filters: {},
			},
			callback: (r) => {
				if (r.message && r.message.result) {
					// Check if report has required image/video field
					const hasMediaField = r.message.result.some(
						(row) => row.img || row.image || row.video
					);

					if (!hasMediaField) {
						// Show error message if no media field found
						this.wrapper.html(`
				<div style="
					height: 100%;
					width: 100%;
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 300px;
					padding: 40px;
					text-align: center;
					background: #f8f9fa;
					border-radius: 8px;
					border: 2px dashed #dee2e6;
				">
					<div>
						<h3 style="color: #495057; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
							Invalid Report Configuration
						</h3>
						<p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5;">
							The selected report must contain at least one of these fields:<br>
							<strong>img</strong>, <strong>image</strong>, or <strong>video</strong>
						</p>
						<p style="color: #868e96; margin: 16px 0 0 0; font-size: 12px;">
							Report: <strong>${this.conf.link_report}</strong>
						</p>
					</div>
				</div>
			`);
						console.error(
							"Report does not contain required media field (img/image/video)"
						);
						return;
					}

					// Report data ko carousel format mein convert karo
					this.data = r.message.result
						.filter((row) => row.img || row.image || row.video) // Only rows with media
						.map((row) => {
							// Debug: Check what fields are available
							return {
								img: row.img || row.image || row.video || "",
								title: row.title || row.name || "",
								// Try multiple possible description field names
								description:
									row.description ||
									row.desc ||
									row.Description ||
									row.details ||
									row.Details ||
									row.content ||
									row.text ||
									row.notes ||
									"",
							};
						});

					if (this.data.length === 0) {
						// Show message if no valid data after filtering
						this.wrapper.html(`
				<div style="
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 300px;
					padding: 40px;
					text-align: center;
					background: #f8f9fa;
					border-radius: 8px;
					border: 1px solid #dee2e6;
				">
					<div>
						<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
							<circle cx="8.5" cy="8.5" r="1.5"></circle>
							<polyline points="21 15 16 10 5 21"></polyline>
						</svg>
						<h3 style="color: #495057; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
							No Media Found
						</h3>
						<p style="color: #6c757d; margin: 0; font-size: 14px;">
							The report returned no rows with valid image or video data.
						</p>
					</div>
				</div>
			`);
						return;
					}

					this.init();
				} else {
					console.error("No report data found");
					// Fallback to manual carousel data
					this.data = this.conf?.carousel || [];

					if (this.data.length === 0) {
						this.wrapper.html(`
				<div style="
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 300px;
					padding: 40px;
					text-align: center;
					background: #fff3cd;
					border-radius: 8px;
					border: 1px solid #ffc107;
				">
					<div>
						<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#856404" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
							<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
							<line x1="12" y1="9" x2="12" y2="13"></line>
							<line x1="12" y1="17" x2="12.01" y2="17"></line>
						</svg>
						<h3 style="color: #856404; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
							No Carousel Data
						</h3>
						<p style="color: #856404; margin: 0; font-size: 14px;">
							Please add carousel items or configure a valid report.
						</p>
					</div>
				</div>
			`);
						return;
					}

					this.init();
				}
			},
			error: (err) => {
				console.error("Error loading report:", err);

				// Show error message
				this.wrapper.html(`
		<div style="
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 300px;
			padding: 40px;
			text-align: center;
			background: #f8d7da;
			border-radius: 8px;
			border: 1px solid #f5c6cb;
		">
			<div>
				<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#721c24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="15" y1="9" x2="9" y2="15"></line>
					<line x1="9" y1="9" x2="15" y2="15"></line>
				</svg>
				<h3 style="color: #721c24; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
					Error Loading Report
				</h3>
				<p style="color: #721c24; margin: 0; font-size: 14px;">
					Failed to load report data. Please check the report configuration.
				</p>
				<p style="color: #721c24; margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">
					${err.message || "Unknown error"}
				</p>
			</div>
		</div>
	`);

				// Fallback to manual carousel data if available
				this.data = this.conf?.carousel || [];
				if (this.data.length > 0) {
					setTimeout(() => this.init(), 2000); // Show error for 2 seconds then load manual data
				}
			},
		});
	}

	init() {
		if (!this.data || this.data.length === 0) {
			this.wrapper.html(
				'<div style="padding:20px;text-align:center;color:#888;">No carousel data available</div>'
			);
			return;
		}

		this.wrapper.html(generateCarouselHTML(this.data));
		this.carousel = this.wrapper.find(".sva-carousel")[0];
		this.viewport = this.wrapper.find(".viewport")[0];
		this.track = this.wrapper.find(".track")[0];
		this.containers = this.wrapper.find(".container");
		this.bullets = this.wrapper.find(".bullet");
		this.pageCounter = this.wrapper.find(".page-counter")[0];
		this.pageCounterCurrent = this.wrapper.find(".page-counter .current")[0];
		this.applyStyles();
		this.attachEvents();
		this.startAuto();
		this.updateSlide();
	}

	getDeviceType() {
		if (this.forceCardLayout) return "mobile";
		const w = window.innerWidth;
		if (w < 480) return "mobile-small";
		if (w < 768) return "mobile";
		if (w < 1024) return "tablet";
		if (w < 1440) return "desktop";
		return "desktop-large";
	}

	applyStyles() {
		const deviceType = this.getDeviceType();
		const isMobileSmall = deviceType === "mobile-small";
		const isMobile = deviceType === "mobile" || isMobileSmall || this.forceCardLayout;
		const isTablet = deviceType === "tablet" && !this.forceCardLayout;
		let config = { ...responsiveConfig[deviceType] };
		config = applyConfigOverrides(config, this.conf, deviceType);
		applyStyles(
			this.carousel,
			this.viewport,
			this.track,
			this.containers,
			this.wrapper,
			this.conf,
			config,
			isMobile,
			isMobileSmall,
			isTablet,
			this.currentIndex
		);
	}

	updateSlide() {
		this.track.style.transform = `translateX(-${
			this.currentIndex * this.viewport.clientWidth
		}px)`;

		// Sabhi videos pause karo EXCEPT current wala
		this.containers.each((i, c) => {
			if (i !== this.currentIndex) {
				pauseAllVideos(c);
			}
		});

		// Current video play karo
		const cur = this.containers[this.currentIndex];
		if (cur) playCurrentVideo(cur, this.conf);

		const isDark = (this.conf?.indicator_style || "Light").toLowerCase() === "dark";
		const bulletColor = "#fff";
		const bulletInactive = isDark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.5)";
		this.bullets.each((i, b) => {
			const isActive = i === this.currentIndex;
			Object.assign(b.style, {
				background: isActive ? bulletColor : bulletInactive,
				transform: isActive ? "scale(1.3)" : "scale(1)",
				boxShadow: isActive
					? isDark
						? "0 0 10px rgba(255,255,255,0.9)"
						: "0 0 10px rgba(255,255,255,0.8)"
					: "none",
			});
		});
		if (this.pageCounterCurrent) this.pageCounterCurrent.textContent = this.currentIndex + 1;
	}

	next() {
		this.currentIndex = (this.currentIndex + 1) % this.data.length;
		this.updateSlide();
	}
	prev() {
		this.currentIndex = (this.currentIndex - 1 + this.data.length) % this.data.length;
		this.updateSlide();
	}

	attachEvents() {
		const isDark = (this.conf?.indicator_style || "Light").toLowerCase() === "dark";
		this.wrapper.find(".next").on("click", () => {
			this.stopAuto();
			this.next();
			this.startAuto();
		});
		this.wrapper.find(".prev").on("click", () => {
			this.stopAuto();
			this.prev();
			this.startAuto();
		});
		this.bullets.each((i, b) => {
			b.addEventListener("click", () => {
				this.stopAuto();
				this.currentIndex = i;
				this.updateSlide();
				this.startAuto();
			});
			b.addEventListener("mouseenter", () => {
				if (i !== this.currentIndex)
					b.style.background = isDark
						? "rgba(255,255,255,0.7)"
						: "rgba(255,255,255,0.8)";
			});
			b.addEventListener("mouseleave", () => {
				if (i !== this.currentIndex)
					b.style.background = isDark
						? "rgba(255,255,255,0.4)"
						: "rgba(255,255,255,0.5)";
			});
		});

		const handleTouchStart = (e) => {
			this.touchStartX = e.touches[0].clientX;
			this.stopAuto();
		};
		const handleTouchMove = (e) => {
			this.touchEndX = e.touches[0].clientX;
		};
		const handleTouchEnd = () => {
			const diff = this.touchStartX - this.touchEndX;
			if (Math.abs(diff) > 50) {
				diff > 0 ? this.next() : this.prev();
			}
			this.startAuto();
		};
		this.viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
		this.viewport.addEventListener("touchmove", handleTouchMove, { passive: true });
		this.viewport.addEventListener("touchend", handleTouchEnd);
		this.touchHandlers = { handleTouchStart, handleTouchMove, handleTouchEnd };

		let resizeTimeout;
		this.resizeHandler = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				this.applyStyles();
				this.updateSlide();
			}, 150);
		};
		window.addEventListener("resize", this.resizeHandler);
		window.addEventListener("orientationchange", () =>
			setTimeout(() => {
				this.applyStyles();
				this.updateSlide();
			}, 200)
		);
	}

	startAuto() {
		if (this.conf?.auto_play !== false) {
			this.interval = setInterval(() => this.next(), this.conf?.auto_play_interval || 5000);
		}
	}

	stopAuto() {
		clearInterval(this.interval);
	}

	destroy() {
		this.stopAuto();
		this.containers.each((i, c) => pauseAllVideos(c));
		window.removeEventListener("resize", this.resizeHandler);
		window.removeEventListener("orientationchange", this.resizeHandler);
		if (this.touchHandlers) {
			this.viewport.removeEventListener("touchstart", this.touchHandlers.handleTouchStart);
			this.viewport.removeEventListener("touchmove", this.touchHandlers.handleTouchMove);
			this.viewport.removeEventListener("touchend", this.touchHandlers.handleTouchEnd);
		}
	}
}

export default SVACarousel;
frappe.ui.SVACarousel = SVACarousel;
