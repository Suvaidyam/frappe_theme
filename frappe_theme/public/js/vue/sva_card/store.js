import { reactive, ref } from "vue";

const loader = ref(false);

export const store = reactive({
	loader: loader.value,
});
