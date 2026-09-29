import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import YamlEditor from '../components/YamlEditor.vue'
import { setLocale } from '../i18n'
import { primaryShortcut } from '../utils/platform'

describe('YamlEditor', () => {
  it('编辑并保存原始 YAML 内容', async () => {
    setLocale('en')
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(YamlEditor, {
      props: {
        file: {
          path: '/tmp/workspace/config.yaml',
          content: 'services:\n  api:\n    enabled: true',
        },
        saveContent,
      },
    })

    const editor = wrapper.get('textarea[aria-label="YAML editor"]')
    expect((editor.element as HTMLTextAreaElement).value).toContain('enabled: true')

    await editor.setValue('services:\n  api:\n    enabled: false')
    await wrapper.get('button').trigger('click')

    expect(saveContent).toHaveBeenCalledWith('services:\n  api:\n    enabled: false')
  })

  it('shows Ctrl+S on Windows and accepts both Ctrl+S and Meta+S', async () => {
    setLocale('en')
    expect(primaryShortcut('S', 'MacIntel')).toBe('⌘S')
    expect(primaryShortcut('S', 'Win32')).toBe('Ctrl+S')
    const platform = vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32')
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(YamlEditor, {
      props: {
        file: { path: 'C:\\Users\\Reviewer\\config.yaml', content: 'enabled: true' },
        saveContent,
      },
    })

    expect(wrapper.get('button').text()).toBe('Save (Ctrl+S)')
    const editor = wrapper.get('textarea')
    await editor.setValue('enabled: false')
    await editor.trigger('keydown', { key: 's', ctrlKey: true })
    await flushPromises()
    expect(saveContent).toHaveBeenCalledWith('enabled: false')

    await editor.setValue('enabled: maybe')
    await editor.trigger('keydown', { key: 's', metaKey: true })
    await flushPromises()
    expect(saveContent).toHaveBeenCalledWith('enabled: maybe')

    wrapper.unmount()
    platform.mockRestore()
  })
})
