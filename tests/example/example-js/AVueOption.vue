<template>
	<p>Has published books:</p>
	<custom-comp></custom-comp>
	<!-- <span>{{ author.books.length > 0 ? "Yes" : "No" }}</span> -->
</template>
<script lang="ts">
	import CustomComp from "./CustomComp.vue";
	export default {
		/* Start <comment */
		// Second <cc />
		components: [CustomComp],
		data() {
			return {
				author: {
					name: "John Doe",
					books: [
						"Vue 2 - Advanced Guide",
						"Vue 3 - Basic Guide",
						"Vue 4 - The Mystery",
					],
				},
			};
		},
	};
</script>
