import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatRelativeTime, formatVisitCount } from '../formatters'

/**
 * Property 1: Tooltip Content Formatting
 * For any link with visit statistics, the tooltip SHALL display:
 * - Visit count formatted as "访问 N 次" where N is the visit count
 * - Last visit time as a valid relative time string
 * Validates: Requirements 1.2, 1.3
 */
describe('formatVisitCount', () => {
  it('should return "尚未访问" for 0 or null/undefined', () => {
    expect(formatVisitCount(0)).toBe('尚未访问')
    expect(formatVisitCount(null)).toBe('尚未访问')
    expect(formatVisitCount(undefined)).toBe('尚未访问')
  })

  it('should format positive counts as "访问 N 次"', () => {
    expect(formatVisitCount(1)).toBe('访问 1 次')
    expect(formatVisitCount(5)).toBe('访问 5 次')
    expect(formatVisitCount(100)).toBe('访问 100 次')
  })

  // Property test: For any positive integer, output matches pattern "访问 N 次"
  it('property: positive counts always match pattern "访问 N 次"', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (count) => {
        const result = formatVisitCount(count)
        expect(result).toBe(`访问 ${count} 次`)
        expect(result).toMatch(/^访问 \d+ 次$/)
      }),
      { numRuns: 100 }
    )
  })
})

describe('formatRelativeTime', () => {
  it('should return "尚未访问" for null/undefined', () => {
    expect(formatRelativeTime(null)).toBe('尚未访问')
    expect(formatRelativeTime(undefined)).toBe('尚未访问')
  })

  it('should return "刚刚" for times within 60 seconds', () => {
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe('刚刚')
    
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000)
    expect(formatRelativeTime(thirtySecondsAgo.toISOString())).toBe('刚刚')
  })

  it('should return "N分钟前" for times within an hour', () => {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5分钟前')
  })

  it('should return "N小时前" for times within a day', () => {
    const now = new Date()
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3小时前')
  })

  it('should return "昨天" for times 24-48 hours ago', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000)
    expect(formatRelativeTime(yesterday.toISOString())).toBe('昨天')
  })

  it('should return "N天前" for times within a week', () => {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe('3天前')
  })

  // Property test: Output is always a non-empty string for valid dates
  it('property: valid dates always produce non-empty relative time strings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 * 5 }), // days ago (up to 5 years)
        (daysAgo) => {
          const now = new Date()
          const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
          const result = formatRelativeTime(date.toISOString())
          expect(result).toBeTruthy()
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)
          // Should match one of the expected patterns
          const validPatterns = [
            /^刚刚$/,
            /^\d+分钟前$/,
            /^\d+小时前$/,
            /^昨天$/,
            /^\d+天前$/,
            /^\d+周前$/,
            /^\d+个月前$/,
            /^\d+年前$/,
          ]
          const matchesPattern = validPatterns.some(p => p.test(result))
          expect(matchesPattern).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property test: More recent dates produce "smaller" time descriptions
  it('property: time descriptions are monotonic with time difference', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 59 }), // minutes
        (minutes) => {
          const now = new Date()
          const date = new Date(now.getTime() - minutes * 60 * 1000)
          const result = formatRelativeTime(date.toISOString())
          expect(result).toMatch(/^\d+分钟前$/)
          const extractedMinutes = parseInt(result.match(/^(\d+)分钟前$/)?.[1] || '0')
          expect(extractedMinutes).toBe(minutes)
        }
      ),
      { numRuns: 50 }
    )
  })
})
