import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CommentTooltip from '../components/CommentTooltip.vue'
import type { Selection } from '../utils/selection'

describe('CommentTooltip', () => {
  it('将当前选区交给评论侧边栏', async () => {
    const selection: Selection = {
      text: 'Comment target phrase',
      start: 5,
      end: 26,
      rect: new DOMRect(10, 20, 100, 20),
    }

    const wrapper = mount(CommentTooltip, {
      props: {
        show: true,
        selection,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Add comment')!.trigger('click')

    expect(wrapper.emitted('startComment')).toEqual([[selection]])
  })

  it('点击翻译时发出当前选区', async () => {
    const selection: Selection = {
      text: 'Translate me',
      start: 0,
      end: 12,
      rect: new DOMRect(10, 20, 100, 20),
    }

    const wrapper = mount(CommentTooltip, {
      props: {
        show: true,
        selection,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Translate')!.trigger('click')

    expect(wrapper.emitted('translate')).toEqual([[selection]])
  })
})
