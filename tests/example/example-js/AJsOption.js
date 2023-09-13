import AVueOption from './AVueOption.vue'
export default {
  components: [AVueOption],
  template: `<div class="rounded-full d-flex align-items-center justify-content-center fs-3 w-avatar h-avatar bg-default">
  <h1>Title</h1>
    <slot></slot>
    <AvuOption />
  </div>`
}
