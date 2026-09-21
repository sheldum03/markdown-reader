import { expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import IconButton from '../components/IconButton.vue'

it('renders an accessible 44px IconPark action button', async () => {
  const click = vi.fn()
  const wrapper = mount(IconButton, {
    props: { icon: 'save', label: '保存' },
    attrs: { onClick: click, 'aria-pressed': true },
  })

  expect(wrapper.find('svg').exists()).toBe(true)
  expect(wrapper.attributes('title')).toBe('保存')
  expect(wrapper.attributes('aria-label')).toBe('保存')
  expect(wrapper.attributes('aria-pressed')).toBe('true')
  expect(wrapper.classes()).toContain('icon-button')
  expect(wrapper.get('.sr-only').text()).toBe('保存')

  await wrapper.trigger('click')
  expect(click).toHaveBeenCalledOnce()

  await wrapper.setProps({ label: 'Saving' })
  expect(wrapper.attributes('title')).toBe('Saving')

  wrapper.unmount()
  const disabled = mount(IconButton, {
    props: { icon: 'save', label: 'Saving' },
    attrs: { disabled: true, title: '等待写入完成' },
  })
  expect(disabled.attributes('disabled')).toBeDefined()
  expect(disabled.attributes('title')).toBe('Saving: 等待写入完成')
})
