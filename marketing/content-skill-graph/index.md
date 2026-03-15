# Signal Eye Content System

Content system for Signal Eye — a trend intelligence platform that ingests data from 28+ sources, scores trends across 5 dimensions, and surfaces what's emerging before it's obvious.

This skill graph manages content production across all platforms from a single topic input.

## Node Map

### Platforms
- [[platforms/x]] — short-form, hook-driven, 280 chars, 5-7x/week. primary growth channel
- [[platforms/linkedin]] — professional narrative, thought leadership, 3x/week
- [[platforms/instagram]] — carousel-first, visual data stories, 3x/week
- [[platforms/tiktok]] — raw screen recordings + talking head, trend breakdowns, 3-5x/week
- [[platforms/blog]] — long-form SEO content, 1-2x/week (post-MVP)

### Voice
- [[voice/brand-voice]] — Signal Eye's personality, tone, and language rules
- [[voice/platform-tone]] — how voice adapts per platform while staying consistent

### Engine
- [[engine/hooks]] — scroll-stopping openers by format and platform
- [[engine/repurpose]] — 1 topic input -> multi-platform output chain
- [[engine/scheduling]] — posting cadence, time slots, content mix ratios
- [[engine/content-types]] — recurring formats and series that build audience

### Audience
- [[audience/founders-pms]] — startup founders, product managers spotting market opportunities
- [[audience/creators]] — content creators, newsletter writers looking for what to cover next
- [[audience/investors]] — VCs, angels tracking emerging tech and market signals
- [[audience/seo-teams]] — SEO and growth teams inside organisations tracking search trends

## Execution Instructions

When given a topic:

1. Read [[voice/brand-voice]] and [[voice/platform-tone]] for tone calibration
2. Read [[engine/hooks]] and select hook style per platform
3. Read relevant [[audience/*]] nodes to understand who cares about this topic and why
4. Read each [[platforms/*]] node for format, length, and style constraints
5. Run [[engine/repurpose]] chain: write X post first, then expand/adapt for each platform
6. Output one native post per platform, each ready to publish
7. Each post should think about the topic differently — not reformatted copies

When given a Signal Eye data export or trend ranking:

1. Identify the 2-3 most interesting stories in the data (biggest movers, surprising entries, breakouts)
2. Follow the execution chain above for each story
3. Include specific numbers and rankings from the data — concrete beats vague
