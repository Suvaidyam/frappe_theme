<template>
    <div class="dynamic-html-wrapper">
        <Loader v-if="loading" />
        <div v-else-if="error" class="dh-error">{{ error }}</div>
        <div v-else>
            <iframe ref="iframeEl" class="dh-iframe" :sandbox="sandboxAttr" :srcdoc="srcdoc" frameborder="0"
                style="width: 100%; border: 0;"></iframe>
        </div>
    </div>
</template>

<script>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import Loader from '../VueLoader.vue';
export default {
    name: 'DynamicHtml',
    components: { Loader },
    props: {
        frm: { type: Object, default: null },
        connection: { type: Object, default: null },
        html: { type: String, default: '' },
        allowScripts: { type: Boolean, default: true },
    },
    setup(props) {
        const iframeEl = ref(null);
        const loading = ref(false);
        const error = ref('');
        const htmlContent = ref(props.html || '');
        const observer = ref(null);
        const messageHandler = (e) => {
            // Accept resize messages from the iframe content
            try {
                if (!iframeEl.value || e.source !== iframeEl.value.contentWindow) return;
                const data = e.data || {};
                if (data && (data.type === 'dynamic-html:resize' || data.type === 'resize') && data.height) {
                    setIframeHeight(data.height);
                }
            } catch { }
        };

        const sandboxAttr = computed(() => {
            // Security: never combine allow-scripts with allow-same-origin to prevent potential sandbox escape.
            // Scripts allowed => keep opaque origin (no allow-same-origin).
            // Scripts not allowed => most restrictive (no tokens).
            return props.allowScripts ? 'allow-scripts' : '';
        });

        const srcdoc = computed(() => {
            const content = htmlContent.value || '';
            const autoResizeScript = props.allowScripts
                ? '<scr' + 'ipt>(function(){function h(){try{var d=document;var b=d.body;var e=d.documentElement;var H=Math.max(b.scrollHeight||0,e.scrollHeight||0,b.offsetHeight||0,e.offsetHeight||0);parent.postMessage({type:\'dynamic-html:resize\',height:H},\'*\')}catch(_){} }window.addEventListener(\'load\',h);try{if(window.ResizeObserver){var ro=new ResizeObserver(function(){h()});ro.observe(document.body)}var mo=new MutationObserver(function(){h()});mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,characterData:true});setTimeout(h,50)}catch(_){} })();</scr' + 'ipt>'
                : '';
            return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;}</style></head><body>${content}${autoResizeScript}</body></html>`;
        });

        const fetchHtml = async () => {
            loading.value = true;
            error.value = '';
            try {
                const response = await frappe.xcall(props.connection.endpoint, {
                    doc: props.frm?.doc,
                });
                htmlContent.value = response;
            } catch (e) {
                error.value = 'Failed to load content.';
                console.error(e);
            } finally {
                loading.value = false;
            }
        };

        const normalizeCssSize = (val) => {
            if (val == null) return '';
            if (typeof val === 'number') return `${val}px`;
            const s = String(val).trim();
            // if it already has a unit, use as-is; if pure number, add px
            return /^\d+$/.test(s) ? `${s}px` : s;
        };

        const extractPreferredHeight = (html) => {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html || '', 'text/html');
                // Meta tag convention
                const meta =
                    doc.querySelector('meta[name="x-iframe-height"]') ||
                    doc.querySelector('meta[name="iframe-height"]');
                if (meta && meta.getAttribute('content')) {
                    return normalizeCssSize(meta.getAttribute('content'));
                }
                // Data attribute convention
                const dataEl = doc.querySelector('[data-iframe-height]');
                if (dataEl) {
                    const v = dataEl.getAttribute('data-iframe-height');
                    if (v) return normalizeCssSize(v);
                }
            } catch { }
            return '';
        };

        const setIframeHeight = (heightVal) => {
            const el = iframeEl.value;
            if (!el) return;
            const cssVal = normalizeCssSize(heightVal);
            if (cssVal) el.style.height = cssVal;
        };

        const resizeIframe = () => {
            const el = iframeEl.value;
            if (!el) return;
            try {
                const doc = el.contentDocument || el.contentWindow?.document;
                if (!doc) return;
                const height = Math.max(
                    doc.body?.scrollHeight || 0,
                    doc.documentElement?.scrollHeight || 0,
                    doc.body?.offsetHeight || 0,
                    doc.documentElement?.offsetHeight || 0
                );
                if (height) {
                    el.style.height = height + 'px';
                }
            } catch { }
        };

        onMounted(() => {
            if (!props.html) {
                fetchHtml();
            }
            window.addEventListener('message', messageHandler);
            if (iframeEl.value) {
                iframeEl.value.addEventListener('load', () => {
                    resizeIframe();
                    try {
                        const doc = iframeEl.value.contentDocument;
                        if (doc) {
                            observer.value = new MutationObserver(resizeIframe);
                            observer.value.observe(doc.documentElement, {
                                childList: true,
                                subtree: true,
                                attributes: true,
                                characterData: true,
                            });
                        }
                    } catch { }
                });
            }
        });

        onBeforeUnmount(() => {
            if (observer.value) {
                observer.value.disconnect();
                observer.value = null;
            }
            window.removeEventListener('message', messageHandler);
        });

        watch(
            () => props.html,
            (v) => {
                if (v) {
                    htmlContent.value = v;
                    const preferred = extractPreferredHeight(v);
                    if (preferred) setIframeHeight(preferred);
                    setTimeout(resizeIframe, 50);
                }
            }
        );

        watch(
            () => htmlContent.value,
            () => {
                const preferred = extractPreferredHeight(htmlContent.value);
                if (preferred) setIframeHeight(preferred);
                setTimeout(resizeIframe, 50);
            }
        );

        watch(
            () => props.connection && props.connection.endpoint,
            (v, ov) => {
                if (v && v !== ov) fetchHtml();
            }
        );

        return { iframeEl, loading, error, sandboxAttr, srcdoc };
    },
};
</script>

<style scoped>
.dynamic-html-wrapper {
    position: relative;
    width: 100%;
    min-height: 200px;
}

.dh-iframe {
    width: 100%;
    display: block;
}

.dh-error {
    color: #dc3545;
}
</style>
