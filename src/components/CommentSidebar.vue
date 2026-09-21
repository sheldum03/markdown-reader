<template>
  <div class="comment-sidebar p-4 bg-[#fafafc]">
    <h3 class="text-base font-semibold mb-4">{{ t('comments', { count: comments.length }) }}</h3>

    <div v-if="comments.length === 0" class="text-gray-400 text-sm text-center py-8">
      {{ t('noComments') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-card p-4 bg-white rounded-[18px] border border-gray-200"
        :class="{ 'opacity-50': comment.status === 'resolved' }"
      >
        <button @click="$emit('locate', comment.id)" class="text-xs text-blue-600 hover:text-blue-700">定位原文</button>
        <div class="comment-quote text-xs text-gray-500 mb-2 italic">
          "{{ comment.anchor.quote }}"
        </div>

        <div class="comment-content text-sm mb-2">
          {{ comment.content }}
        </div>

        <div class="comment-meta flex items-center justify-between text-xs text-gray-400">
          <span>{{ formatTime(comment.createdAt) }}</span>
          <div class="flex gap-2">
            <button
              v-if="comment.status === 'open'"
              @click="$emit('resolve', comment.id)"
              class="text-green-600 hover:text-green-700"
            >
              {{ t('resolve') }}
            </button>
            <button
              @click="$emit('delete', comment.id)"
              class="text-red-600 hover:text-red-700"
            >
              {{ t('delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Comment } from '../stores/comments'
import { locale, t } from '../i18n'

defineProps<{
  comments: Comment[]
}>()

defineEmits<{
  locate: [id: string]
  resolve: [id: string]
  delete: [id: string]
}>()

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
