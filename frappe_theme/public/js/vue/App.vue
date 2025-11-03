<template>
	<NumberCard :title="title" :value="value" :props="props" />
</template>

<script setup>
import { ref } from "vue";
import { useStore } from "./store";
import NumberCard from "./components/NumberCard.vue";
</script>
