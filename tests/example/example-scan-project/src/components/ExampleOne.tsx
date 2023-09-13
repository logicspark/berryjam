import { defineComponent, PropType, ref, RenderFunction } from 'vue';

export default defineComponent({
  name: 'ExampleOne',

  props: {
    msg: {
      type: String,
    },
    obj: {
      type: Object as PropType<{ name: string }>,
      required: true,
    },
    items: {
      type: Array as PropType<{ id: number, name: string }[]>
    },
    onClick: Function as PropType<(str: number) => void>,
    slotWrapItem: Function as PropType<(str: string, num: number) => RenderFunction | JSX.Element>,
  },

  setup(prop) {
    const clickCounter = ref(0)
    const onBtnMeClick = () => {
      clickCounter.value++
      prop.onClick && prop.onClick(clickCounter.value)
    }

    return () => (
      <div class="ExampleOne">
        <h1>Example component on TSX</h1>
        {prop.msg && <p>Message: {prop.msg}</p>}
        <p>Obj.name: "{prop.obj.name}"</p>
        {<button onClick={onBtnMeClick}>Click Me</button>}
        {
          prop.items
            ?.map(({ id, name }) =>
              <p key={id}>{prop.slotWrapItem ? prop.slotWrapItem(name, id) : name}</p>
            )
        }
      </div>
    )
  },
});
