import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CommentSidebar from '../components/CommentSidebar.vue'

describe('CommentSidebar', () => {
  it('在侧边栏内展示选区并提交评论', async () => {
    const wrapper = mount(CommentSidebar, {
      props: {
        comments: [],
        draft: {
          anchor: { quote: 'Selected passage', offset: 0, length: 15 },
          text: 'Selected passage',
        },
      },
    })

    expect(wrapper.text()).toContain('Selected passage')
    await wrapper.find('textarea').setValue('Review this wording')
    await wrapper.findAll('button').find(button => button.text() === 'Submit')!.trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['Review this wording']])
  })

  it('提交中禁用提交按钮', async () => {
    const wrapper = mount(CommentSidebar, {
      props: {
        comments: [],
        submitting: true,
        draft: {
          anchor: { quote: 'Selected passage', offset: 0, length: 15 },
          text: 'Selected passage',
        },
      },
    })

    await wrapper.find('textarea').setValue('Review this wording')
    const submit = wrapper.findAll('button').find(button => button.text() === 'Submit')!

    expect(submit.attributes('disabled')).toBeDefined()
    await submit.trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
