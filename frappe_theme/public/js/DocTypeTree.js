/**
 * DocTypeTree v5
 *   - Full-screen dialog with true full-height canvas
 *   - Auto-detects doctype (no hardcoded default)
 *   - System Manager only
 *   - Light theme
 *   - List View: small button in secondary actions area
 *   - Form View: menu item + Ctrl+Shift+T
 *
 * hooks.py:
 *   app_include_js = ["/assets/your_app/js/DocTypeTree.js"]
 */
class DocTypeTree {
	// ─── D3 CDN Loader ───
	static _d3 = null;
	static _d3Loading = null;
	static CDN = "https://d3js.org/d3.v7.min.js";

	static loadD3() {
		if (DocTypeTree._d3) return Promise.resolve(DocTypeTree._d3);
		if (DocTypeTree._d3Loading) return DocTypeTree._d3Loading;
		DocTypeTree._d3Loading = new Promise((resolve, reject) => {
			if (typeof d3 !== "undefined") {
				DocTypeTree._d3 = d3;
				return resolve(d3);
			}
			const s = document.createElement("script");
			s.src = DocTypeTree.CDN;
			s.onload = () => {
				DocTypeTree._d3 = d3;
				resolve(d3);
			};
			s.onerror = () => reject(new Error("Failed to load D3.js"));
			document.head.appendChild(s);
		});
		return DocTypeTree._d3Loading;
	}

	static hasAccess() {
		return (frappe.user_roles || []).includes("System Manager");
	}

	static detectDoctype() {
		if (cur_frm && cur_frm.doctype) return cur_frm.doctype;
		const route = frappe.get_route();
		if (route && route.length >= 2 && ["List", "Form", "Tree"].includes(route[0]))
			return route[1];
		return null;
	}

	// ─── Full-screen dialog ───
	static show(doctype) {
		const dt = doctype || DocTypeTree.detectDoctype();
		if (!dt) {
			frappe.msgprint(__("Could not detect DocType. Open a List or Form view first."));
			return;
		}

		const dlg = new frappe.ui.Dialog({
			title: `${dt} — Relationship Tree`,
			fields: [{ fieldtype: "HTML", fieldname: "tree_container" }],
		});

		const $w = dlg.$wrapper;

		// Force true full-screen on every element in the chain
		$w.find(".modal-dialog").css({
			"max-width": "100vw",
			width: "100vw",
			height: "100vh",
			margin: 0,
			padding: 0,
		});
		$w.find(".modal-content").css({
			"border-radius": 0,
			height: "100vh",
			display: "flex",
			"flex-direction": "column",
			overflow: "hidden",
		});
		$w.find(".modal-header").css({ "flex-shrink": 0 });
		$w.find(".modal-body").css({
			flex: 1,
			padding: 0,
			overflow: "hidden",
			"min-height": 0,
			display: "flex",
			"flex-direction": "column",
		});

		dlg.show();

		// Frappe wraps HTML fields in extra divs — force all of them to fill
		const $field = dlg.fields_dict.tree_container.$wrapper;
		$field.css({ flex: 1, "min-height": 0, display: "flex", "flex-direction": "column" });
		$field.parents(".frappe-control, .form-group").css({
			flex: 1,
			"min-height": 0,
			display: "flex",
			"flex-direction": "column",
		});

		const wrapper = $field[0];
		wrapper.innerHTML = "";

		new DocTypeTree(wrapper, { doctype: dt });

		return dlg;
	}

	// ─── Auto-hook ───
	static _hooked = false;

	static hookIntoViews() {
		if (DocTypeTree._hooked) return;
		DocTypeTree._hooked = true;

		// Form View — menu item
		$(document).on("form-refresh", (e, frm) => {
			try {
				DocTypeTree._addFormMenuItem(frm);
			} catch (e) {
				/* silent */
			}
		});

		// List View — poll after every route change
		frappe.router.on("change", () => {
			setTimeout(() => DocTypeTree._tryAddListButton(), 500);
			setTimeout(() => DocTypeTree._tryAddListButton(), 1500);
		});

		// Also try on initial load
		setTimeout(() => DocTypeTree._tryAddListButton(), 1000);
	}

	static _tryAddListButton() {
		if (!DocTypeTree.hasAccess()) return;

		const route = frappe.get_route();
		if (!route || route[0] !== "List" || !route[1]) return;
		const dt = route[1];

		// Find the current list view page container
		const page = cur_list && cur_list.page;
		if (!page) return;
		if (page._dt_tree_btn) return;
		page._dt_tree_btn = true;

		// Inject a small custom button directly into the page actions area
		const $actions = $(page.wrapper).find(".page-actions");
		if (!$actions.length) return;

		const $btn = $(`<button class="btn btn-default btn-sm ellipsis" title="DocType Tree">
            <svg style="width:14px;height:14px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/>
                <path d="M12 8v4M7.5 17.2 10.5 12M16.5 17.2 13.5 12"/>
            </svg>
            <span class="hidden-xs">DocType Tree</span>
        </button>`);

		$btn.on("click", () => DocTypeTree.show(dt));
		$actions.prepend($btn);
	}

	static _addFormMenuItem(frm) {
		if (!DocTypeTree.hasAccess()) return;
		if (!frm || !frm.doctype || frm._dt_tree_menu) return;
		frm._dt_tree_menu = true;
		frm.page.add_menu_item(
			__("DocType Tree"),
			() => DocTypeTree.show(frm.doctype),
			false,
			"Ctrl+Shift+T",
		);
	}

	// ─── CONSTRUCTOR ───
	constructor(rootEl, opts = {}) {
		if (!opts.doctype) throw new Error("DocTypeTree: doctype is required");
		this.rootEl = rootEl;
		this.opts = Object.assign(
			{
				method: "frappe_theme.apis.doctype.tree.get_dt_tree",
				animDuration: 400,
				nodeYGap: 44,
				nodeXGap: 285,
				maxTextWidth: 195,
				cardPadX: 14,
				cardPadY: 6,
				cardRadius: 8,
				initialDepth: 1,
			},
			opts,
		);

		this.MODULE_COLORS = {
			"mGrant - Project": "#4373e8",
			Mgrant: "#0d9668",
			"mGrant - Task": "#0891b2",
			Trent: "#dc2626",
			"Budget Attribution": "#7c3aed",
			"Mgrant - Integrations": "#d97706",
		};

		this._uid = 0;
		this._matches = [];
		this._sIdx = 0;
		this.d3 = null;
		this.root = null;
		this._init();
	}

	async _init() {
		this._injectStyles();
		this._injectHTML();
		this._cacheEls();
		this._loading(true);
		try {
			this.d3 = await DocTypeTree.loadD3();
			const raw = await this._fetchData();
			if (!raw) return;
			this._setupSVG();
			this._buildTree(raw);
			this._bindEvents();
			this._bindResize();
		} catch (e) {
			console.error("DocTypeTree:", e);
			this.$.canvas.innerHTML = `<div style="padding:40px;color:#dc2626;font-size:13px">Error: ${e.message}</div>`;
		} finally {
			this._loading(false);
		}
	}

	_loading(on) {
		if (this.$.loader) this.$.loader.style.display = on ? "flex" : "none";
	}

	// ─── STYLES ───
	_injectStyles() {
		const style = document.createElement("style");
		style.textContent = `
            .dt-wrap{
                --bg:#ffffff;--bg2:#f8f9fb;--sf:#f1f3f8;--sfh:#e8ebf2;
                --bd:#e2e5ed;--bdh:#cdd1dc;
                --tx:#1a1d26;--t2:#5c6274;--t3:#9098ad;
                --ac:#4373e8;--abg:rgba(67,115,232,.08);
                --gn:#0d9668;--am:#d97706;--ro:#dc2626;--pu:#7c3aed;--cy:#0891b2;
                --f:system-ui,-apple-system,sans-serif;
                --m:'SF Mono','Cascadia Code','Consolas',monospace;
                font-family:var(--f);background:var(--bg);color:var(--tx);
                display:flex;flex-direction:column;
                height:100%;min-height:0;flex:1;overflow:hidden;
            }
            .dt-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--bd);flex-wrap:wrap;flex-shrink:0}
            .dt-title{font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap}.dt-title span{color:var(--t3);font-weight:400}
            .dt-sep{width:1px;height:20px;background:var(--bd);margin:0 2px}
            .dt-search{position:relative;flex:1;min-width:160px;max-width:280px}
            .dt-search svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--t3);pointer-events:none}
            .dt-search input{width:100%;padding:6px 10px 6px 28px;background:var(--bg);border:1px solid var(--bd);border-radius:6px;color:var(--tx);font:12px var(--f);outline:none;transition:border .15s,box-shadow .15s}
            .dt-search input::placeholder{color:var(--t3)}.dt-search input:focus{border-color:var(--ac);box-shadow:0 0 0 2px var(--abg)}
            .dt-acts{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
            .dt-btn{display:flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--t2);font:500 11px/1 var(--f);cursor:pointer;transition:all .12s;white-space:nowrap}
            .dt-btn:hover{background:var(--sf);color:var(--tx);border-color:var(--bdh)}
            .dt-btn-hi{background:var(--ac);border-color:var(--ac);color:#fff}.dt-btn-hi:hover{background:#3563d4}
            .dt-badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--abg);color:var(--ac);font:600 10px/18px var(--m);text-align:center}
            .dt-canvas{flex:1;min-height:0;overflow:hidden;position:relative;background:var(--bg)}
            .dt-canvas svg{display:block;width:100%;height:100%}.node{cursor:pointer}.node:hover .card-bg{filter:brightness(.97)}
            .dt-tip{position:absolute;z-index:50;padding:8px 12px;background:var(--bg);border:1px solid var(--bdh);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.1);pointer-events:none;opacity:0;transition:opacity .12s;max-width:240px;font-size:12px}
            .dt-tip.on{opacity:1}.dt-tip .tt-name{font:600 12px var(--f);color:var(--tx);margin-bottom:2px}.dt-tip .tt-mod{font:10px var(--m);color:var(--t2)}.dt-tip .tt-via{font:10px var(--f);color:var(--t3);margin-top:3px}.dt-tip .tt-circ{font:500 10px var(--f);color:var(--am);margin-top:4px}
            .dt-sbar{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:40;display:none;align-items:center;gap:6px;padding:5px 10px;background:var(--bg);border:1px solid var(--bdh);border-radius:7px;box-shadow:0 4px 16px rgba(0,0,0,.08);font:11px var(--f);color:var(--t2)}
            .dt-sbar.on{display:flex}.dt-sbar .cnt{color:var(--ac);font-weight:600;font-family:var(--m)}
            .dt-sbar .nb{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:1px solid var(--bd);border-radius:4px;background:var(--sf);color:var(--t2);cursor:pointer;font-size:10px}.dt-sbar .nb:hover{background:var(--sfh);color:var(--tx)}.dt-sbar .cb{cursor:pointer;color:var(--t3);font-size:11px}
            .dt-legend{display:flex;gap:10px;padding:7px 14px;background:var(--bg2);border-top:1px solid var(--bd);flex-shrink:0}
            .dt-legend-i{display:flex;align-items:center;gap:4px;font:10px var(--f);color:var(--t3)}.dt-legend-d{width:7px;height:7px;border-radius:50%}
            .dt-loader{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--bg)}
            .dt-loader-spin{width:28px;height:28px;border:3px solid var(--bd);border-top-color:var(--ac);border-radius:50%;animation:dts .7s linear infinite}@keyframes dts{to{transform:rotate(360deg)}}
        `;
		this.rootEl.prepend(style);
	}

	_injectHTML() {
		const dt = frappe.utils.escape_html(this.opts.doctype);
		this.rootEl.insertAdjacentHTML(
			"beforeend",
			`
        <div class="dt-wrap">
            <div class="dt-bar">
                <div class="dt-title">${dt} <span>— Relationship Tree</span></div>
                <div class="dt-sep"></div>
                <div class="dt-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    <input data-ref="search" placeholder="Search DocTypes…" autocomplete="off" spellcheck="false">
                </div>
                <div class="dt-acts">
                    <div class="dt-badge" data-ref="count">0</div>
                    <div class="dt-sep"></div>
                    <button class="dt-btn" data-ref="collapse">▲ Collapse</button>
                    <button class="dt-btn" data-ref="expand">▼ Expand</button>
                    <button class="dt-btn" data-ref="center">◎ Center</button>
                    <button class="dt-btn dt-btn-hi" data-ref="export">↓ PNG</button>
                </div>
            </div>
            <div class="dt-canvas" data-ref="canvas">
                <div class="dt-tip" data-ref="tip"></div>
                <div class="dt-sbar" data-ref="sbar">
                    <span><span class="cnt" data-ref="srCount">0</span> found</span>
                    <button class="nb" data-ref="srPrev">↑</button>
                    <button class="nb" data-ref="srNext">↓</button>
                    <span class="cb" data-ref="srClose">✕</span>
                </div>
                <div class="dt-loader" data-ref="loader"><div class="dt-loader-spin"></div></div>
            </div>
            <div class="dt-legend">
                <div class="dt-legend-i"><div class="dt-legend-d" style="background:var(--ac)"></div>Root</div>
                <div class="dt-legend-i"><div class="dt-legend-d" style="background:var(--gn)"></div>Branch</div>
                <div class="dt-legend-i"><div class="dt-legend-d" style="background:var(--t3)"></div>Leaf</div>
                <div class="dt-legend-i"><div class="dt-legend-d" style="background:var(--am)"></div>Circular</div>
            </div>
        </div>`,
		);
	}

	_cacheEls() {
		this.$ = {};
		this.rootEl.querySelectorAll("[data-ref]").forEach((el) => {
			this.$[el.dataset.ref] = el;
		});
	}

	async _fetchData() {
		try {
			const res = await frappe.call({
				method: this.opts.method,
				args: { doctype: this.opts.doctype },
			});
			return res.message;
		} catch (e) {
			this.$.canvas.innerHTML = `<div style="padding:40px;color:var(--ro);font-size:13px">
                Failed to load tree for <b>${this.opts.doctype}</b>.<br>
                <span style="color:var(--t3);font-size:11px">${e.message || ""}</span></div>`;
			return null;
		}
	}

	// ─── SVG — reads actual canvas dimensions ───
	_setupSVG() {
		const d3 = this.d3,
			el = this.$.canvas;
		this._w = el.clientWidth || window.innerWidth;
		this._h = el.clientHeight || window.innerHeight - 120;
		this.svg = d3.select(el).append("svg").attr("width", this._w).attr("height", this._h);
		this.mainG = this.svg.append("g").attr("class", "main-g");
		this.gLinks = this.mainG.append("g");
		this.gNodes = this.mainG.append("g");
		this.zoom = d3
			.zoom()
			.scaleExtent([0.05, 3])
			.on("zoom", (e) => this.mainG.attr("transform", e.transform));
		this.svg.call(this.zoom);
		this.treeLayout = d3.tree().nodeSize([this.opts.nodeYGap, this.opts.nodeXGap]);
	}

	_bindResize() {
		this._resizeObs = new ResizeObserver((entries) => {
			if (!this.svg) return;
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) {
					this._w = width;
					this._h = height;
					this.svg.attr("width", width).attr("height", height);
				}
			}
		});
		this._resizeObs.observe(this.$.canvas);
	}

	_buildTree(raw) {
		this.root = this.d3.hierarchy(this._norm(raw));
		this.root.x0 = 0;
		this.root.y0 = 0;
		this.root.descendants().forEach((d) => {
			if (d.depth >= this.opts.initialDepth && d.children) {
				d._children = d.children;
				d.children = null;
			}
		});
		this._update(this.root);
		// Defer center so canvas has settled its final height
		requestAnimationFrame(() => {
			this._w = this.$.canvas.clientWidth || this._w;
			this._h = this.$.canvas.clientHeight || this._h;
			this.svg.attr("width", this._w).attr("height", this._h);
			this._centerView();
		});
		this._updCount();
	}

	_norm(n, via) {
		return {
			id: n.name + "_" + this._uid++,
			name: n.name,
			label: n.label,
			module: n.module || "",
			circular: !!n.circular,
			via: via || null,
			children: n.children
				? n.children.map((c) =>
						this._norm(c.tree, { field: c.via_field, label: c.via_label }),
					)
				: [],
		};
	}

	_col(d) {
		if (d.data.circular) return "#d97706";
		if (d.depth === 0) return "#4373e8";
		return this.MODULE_COLORS[d.data.module] || "#9098ad";
	}

	_lp(d) {
		const mx = (d.source.y + d.target.y) / 2;
		return `M${d.source.y},${d.source.x} C${mx},${d.source.x} ${mx},${d.target.x} ${d.target.y},${d.target.x}`;
	}

	_update(src) {
		const d3 = this.d3,
			o = this.opts;
		this.treeLayout(this.root);
		const nodes = this.root.descendants(),
			links = this.root.links();

		const lk = this.gLinks.selectAll("path.link").data(links, (d) => d.target.data.id);
		const lkE = lk
			.enter()
			.append("path")
			.attr("class", "link")
			.attr("fill", "none")
			.attr("d", () => {
				const p = { x: src.x0, y: src.y0 };
				return this._lp({ source: p, target: p });
			});
		lkE.merge(lk)
			.transition()
			.duration(o.animDuration)
			.attr("d", (d) => this._lp(d))
			.attr("stroke", (d) => (d.target.data.circular ? "#d9770640" : "#d5d9e3"))
			.attr("stroke-width", (d) => (d.target.data.circular ? 1.2 : 1.4))
			.attr("stroke-dasharray", (d) => (d.target.data.circular ? "5,4" : "none"));
		lk.exit()
			.transition()
			.duration(o.animDuration)
			.attr("d", () => {
				const p = { x: src.x, y: src.y };
				return this._lp({ source: p, target: p });
			})
			.remove();

		const nd = this.gNodes.selectAll("g.node").data(nodes, (d) => d.data.id);
		const nE = nd
			.enter()
			.append("g")
			.attr("class", "node")
			.attr("transform", `translate(${src.y0},${src.x0})`)
			.style("opacity", 0)
			.on("click", (e, d) => {
				e.stopPropagation();
				this._toggle(d);
			})
			.on("dblclick", (e, d) => {
				e.stopPropagation();
				this._openDT(d);
			})
			.on("mouseenter", (e, d) => this._sTip(e, d))
			.on("mousemove", (e) => this._mTip(e))
			.on("mouseleave", () => this._hTip());

		nE.append("rect")
			.attr("class", "card-bg")
			.attr("rx", o.cardRadius)
			.attr("ry", o.cardRadius);
		nE.append("circle").attr("class", "dot").attr("r", 3.5).attr("cy", 0);
		nE.append("text")
			.attr("class", "icon")
			.attr("dy", ".35em")
			.style("font-size", "9px")
			.style("fill", "#9098ad")
			.style("font-family", "monospace");
		nE.append("text")
			.attr("class", "label")
			.attr("dy", ".35em")
			.style("font-family", "system-ui,-apple-system,sans-serif");
		nE.filter((d) => d.data.circular)
			.append("text")
			.attr("class", "circ")
			.attr("dy", ".35em")
			.style("font-size", "9px")
			.style("fill", "#d97706")
			.text("↺");
		nE.append("text")
			.attr("class", "ccount")
			.attr("dy", ".35em")
			.style("font-size", "9px")
			.style("font-family", "monospace")
			.style("fill", "#9098ad");

		const all = nE.merge(nd);
		all.each((d, i, els) => this._layNode(d3.select(els[i]), d));
		all.transition()
			.duration(o.animDuration)
			.attr("transform", (d) => `translate(${d.y},${d.x})`)
			.style("opacity", 1);
		nd.exit()
			.transition()
			.duration(o.animDuration)
			.attr("transform", `translate(${src.y},${src.x})`)
			.style("opacity", 0)
			.remove();
		nodes.forEach((d) => {
			d.x0 = d.x;
			d.y0 = d.y;
		});
		this._updCount();
	}

	_layNode(g, d) {
		const o = this.opts;
		const kids = d.children || d._children;
		const kc = d._children ? d._children.length : d.children ? d.children.length : 0;

		const lb = g.select(".label");
		lb.text(d.data.label)
			.style("font-size", d.depth === 0 ? "13px" : "11.5px")
			.style("font-weight", d.depth === 0 ? "600" : kids ? "500" : "400")
			.style("fill", d.data.circular ? "#92400e" : "#1a1d26");
		this._wrap(lb, d.data.label, o.maxTextWidth);

		const bb = lb.node().getBBox();
		const ds = 18,
			cw = d.data.circular ? 16 : 0,
			tw = kids ? 14 : 0,
			ccw = kids && kc ? 22 : 0;
		const W = o.cardPadX + ds + bb.width + 6 + cw + tw + ccw + o.cardPadX;
		const H = Math.max(30, bb.height + o.cardPadY * 2 + 4);

		const ts = lb.selectAll("tspan");
		if (ts.size() > 1) {
			const lh = 14,
				tot = ts.size() * lh;
			ts.each(function (_, i) {
				DocTypeTree._d3
					.select(this)
					.attr("dy", i === 0 ? -tot / 2 + lh / 2 + "px" : lh + "px");
			});
		}

		g.select(".dot").attr("cx", o.cardPadX + 5);
		lb.attr("x", o.cardPadX + ds).attr("y", 0);

		let cx = o.cardPadX + ds + bb.width + 8;
		if (d.data.circular) {
			g.select(".circ").attr("x", cx);
			cx += cw;
		}
		if (kids) {
			g.select(".icon")
				.attr("x", cx)
				.text(d.children ? "−" : "+");
			cx += tw;
			g.select(".ccount")
				.attr("x", cx + 2)
				.text(kc > 0 ? kc : "");
		} else {
			g.select(".icon").text("");
			g.select(".ccount").text("");
		}

		const c = this._col(d);
		g.select(".card-bg")
			.attr("width", W)
			.attr("height", H)
			.attr("y", -H / 2)
			.attr("fill", c + "0a")
			.attr("stroke", c + "30")
			.attr("stroke-width", 1);
		g.select(".dot").attr("fill", c);
	}

	_wrap(sel, str, mw) {
		sel.text(null);
		const w = str.split(/\s+/);
		if (w.length <= 1) {
			sel.text(str);
			return;
		}
		let ln = [],
			ts = sel.append("tspan").attr("x", sel.attr("x")).attr("dy", "0");
		for (const x of w) {
			ln.push(x);
			ts.text(ln.join(" "));
			if (ts.node().getComputedTextLength() > mw && ln.length > 1) {
				ln.pop();
				ts.text(ln.join(" "));
				ln = [x];
				ts = sel.append("tspan").attr("x", sel.attr("x")).attr("dy", "1.2em").text(x);
			}
		}
	}

	_toggle(d) {
		if (d.children) {
			d._children = d.children;
			d.children = null;
		} else if (d._children) {
			d.children = d._children;
			d._children = null;
		}
		this._update(d);
	}

	_openDT(d) {
		if (d.data.name && !d.data.circular) frappe.set_route("Form", "DocType", d.data.name);
	}

	_sTip(e, d) {
		let h = `<div class="tt-name">${d.data.label}</div>`;
		if (d.data.module) h += `<div class="tt-mod">${d.data.module}</div>`;
		if (d.data.via)
			h += `<div class="tt-via">via <b>${d.data.via.label}</b> (${d.data.via.field})</div>`;
		if (d.data.circular) h += `<div class="tt-circ">↺ Circular reference</div>`;
		const cc = (d.children || d._children || []).length;
		if (cc) h += `<div class="tt-via">${cc} child${cc > 1 ? "ren" : ""}</div>`;
		h += `<div class="tt-via" style="margin-top:5px;color:var(--ac)">Double-click → open DocType</div>`;
		this.$.tip.innerHTML = h;
		this.$.tip.classList.add("on");
	}
	_mTip(e) {
		const r = this.$.canvas.getBoundingClientRect();
		this.$.tip.style.left = e.clientX - r.left + 12 + "px";
		this.$.tip.style.top = e.clientY - r.top - 8 + "px";
	}
	_hTip() {
		this.$.tip.classList.remove("on");
	}

	_doSearch() {
		const q = this.$.search.value.toLowerCase().trim();
		this._matches = [];
		this._sIdx = 0;
		this.gNodes
			.selectAll(".card-bg")
			.attr("stroke", (_, i, els) => {
				const dm = this.d3.select(els[i].parentNode).datum();
				return dm ? this._col(dm) + "30" : "transparent";
			})
			.attr("stroke-width", 1);
		if (!q) {
			this.$.sbar.classList.remove("on");
			return;
		}

		this.root.descendants().forEach((d) => {
			if (d.data.label.toLowerCase().includes(q) || d.data.name.toLowerCase().includes(q)) {
				this._matches.push(d);
				let p = d.parent;
				while (p) {
					if (!p.children && p._children) {
						p.children = p._children;
						p._children = null;
					}
					p = p.parent;
				}
			}
		});
		this._update(this.root);
		if (this._matches.length) {
			this.$.sbar.classList.add("on");
			this.$.srCount.textContent = this._matches.length;
			this.gNodes
				.selectAll(".card-bg")
				.attr("stroke", (d) =>
					this._matches.includes(d) ? "#4373e8" : this._col(d) + "30",
				)
				.attr("stroke-width", (d) => (this._matches.includes(d) ? 2 : 1));
			this._panTo(this._matches[0]);
		} else {
			this.$.sbar.classList.remove("on");
		}
	}

	_panTo(d) {
		this.svg
			.transition()
			.duration(480)
			.call(
				this.zoom.transform,
				this.d3.zoomIdentity
					.translate(-d.y * 1.1 + this._w / 2, -d.x * 1.1 + this._h / 2)
					.scale(1.1),
			);
	}

	_centerView() {
		this.svg
			.transition()
			.duration(600)
			.call(
				this.zoom.transform,
				this.d3.zoomIdentity.translate(this._w * 0.08, this._h / 2).scale(0.7),
			);
	}

	_updCount() {
		if (this.root) this.$.count.textContent = this.root.descendants().length;
	}

	_exportPNG() {
		const bb = this.mainG.node().getBBox(),
			p = 60;
		const cl = this.svg.node().cloneNode(true);
		cl.setAttribute("width", bb.width + p * 2);
		cl.setAttribute("height", bb.height + p * 2);
		cl.querySelector(".main-g").setAttribute(
			"transform",
			`translate(${-bb.x + p},${-bb.y + p})`,
		);
		const s = new XMLSerializer().serializeToString(cl);
		const img = new Image();
		img.onload = () => {
			const c = document.createElement("canvas");
			c.width = bb.width + p * 2;
			c.height = bb.height + p * 2;
			const ctx = c.getContext("2d");
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, c.width, c.height);
			ctx.drawImage(img, 0, 0);
			const a = document.createElement("a");
			a.download = `${this.opts.doctype}-tree.png`;
			a.href = c.toDataURL("image/png");
			a.click();
		};
		img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s)));
	}

	_bindEvents() {
		let t;
		this.$.search.addEventListener("input", () => {
			clearTimeout(t);
			t = setTimeout(() => this._doSearch(), 220);
		});
		this.$.srNext.onclick = () => {
			if (!this._matches.length) return;
			this._sIdx = (this._sIdx + 1) % this._matches.length;
			this._panTo(this._matches[this._sIdx]);
		};
		this.$.srPrev.onclick = () => {
			if (!this._matches.length) return;
			this._sIdx = (this._sIdx - 1 + this._matches.length) % this._matches.length;
			this._panTo(this._matches[this._sIdx]);
		};
		this.$.srClose.onclick = () => {
			this.$.search.value = "";
			this._doSearch();
		};
		this.$.expand.onclick = () => {
			this.root.descendants().forEach((d) => {
				if (d._children) {
					d.children = d._children;
					d._children = null;
				}
			});
			this._update(this.root);
		};
		this.$.collapse.onclick = () => {
			this.root.descendants().forEach((d) => {
				if (d.depth >= 1 && d.children) {
					d._children = d.children;
					d.children = null;
				}
			});
			this._update(this.root);
		};
		this.$.center.onclick = () => this._centerView();
		this.$.export.onclick = () => this._exportPNG();
	}

	expandTo(label) {
		this.$.search.value = label;
		this._doSearch();
	}

	destroy() {
		if (this._resizeObs) this._resizeObs.disconnect();
		this.rootEl.querySelector(".dt-wrap")?.remove();
		this.rootEl.querySelector("style")?.remove();
	}
}

// ═══ AUTO-HOOK ═══
DocTypeTree.hookIntoViews();
