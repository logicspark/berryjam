# Introduction

Rules are ways to identify information of the component profiles, including props in your codebase. The built-in-rules consist of different ways a Vue component can be created and/or extended.

If you are unable to find a rule that is applied in your project, feel free to submit a request [here](../../../../issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yml&title=✨+).

## How to Detect Vue Components

We look at component naming and how a component can be created based on different file extensions (`.vue`, `.js`, `.jsx`, `.ts` and `.tsx`). We use parsed function to parsed file content and detect which components are used as follows:

- **.vue**: [@vue/compiler-sfc](https://www.npmjs.com/package/@vue/compiler-sfc)
- **.js, jsx**: [@babel/parser](https://www.npmjs.com/package/@babel/parser)

```js
// parse options
{
  sourceType: "module",
  plugins: ["jsx"],
}
```

- **.ts**: [@babel/parser](https://www.npmjs.com/package/@babel/parser)

```js
// parse options
{
  sourceType: "module",
  plugins: ["typescript"],
}
```

- **.tsx**: [@babel/parser](https://www.npmjs.com/package/@babel/parser)

```js
// parse options
{
  sourceType: "module",
  plugins: ["typescript", "jsx"],
}
```

## How to Use Props

We look at how a prop can be used based on different file extensions (`.vue`, `.js`, `.jsx`, `.ts` and `.tsx`).

Case 1: **.vue**, **.js**, **.jsx**, **.ts**, **.tsx**

```vue
<script>
export default {
  props: ["prop1", "prop2"],
};
</script>
```

Case 2: **.vue**, **.js**, **.jsx**, **.ts**, **.tsx**

```vue
<script>
export default {
  props: [{
    prop1: {
      type: String,
    },
    prop2: {
      type: String,
      required: true,
    }
  }],
};
</script>
```

Case 3: **.vue**, **.js**, **.jsx**, **.ts**, **.tsx**

```vue
<script>
import props from "path/to/internal/folder";
export default {
  props: props,
};
</script>
```

Case 4: **.vue**

```vue
<script setup>
  const props = defineProps(["prop1", "prop2"]);
</script>
```

Case 5: **.vue**

```vue
<script setup>
const props = defineProps([
{
  prop1: {
    type: String,
  },
  prop2: {
    type: String,
    required: true,
  },
}]);
</script>
```

Case 6: **.vue**

```vue
<script setup lang="ts">
import { DefaultProps } from "path/to/internal/folder";

interface InnerProps {
  prop1: string;
  prop2: number;
}
interface Props extends DefaultProps {
  prop1: InnerProps;
}
const props = defineProps<Props>();
</script>
```

**_NOTE:_** 📝 Not working in case of import interface from external package (node_modules)
