/** Identifies the skill family enhanced by a rune. */
export type RuneSkill = 'attack' | 'nova' | 'dash' | 'ward'

/** Describes one available permanent rune upgrade. */
export interface RuneDefinition {
  /** Stable id persisted in the in-memory build. */
  id: string
  /** Skill family receiving the upgrade. */
  skill: RuneSkill
  /** Short glyph used by the choice card. */
  glyph: string
  /** Display name shown after a region is cleansed. */
  name: string
  /** Maximum selectable rank. */
  maxRank: number
  /** Produces rank-specific copy for the selection card. */
  description: (rank: number) => string
}

/** Maps rune ids to their currently selected ranks. */
export type RuneRanks = Record<string, number>

/** The deterministic rune library mirrored from the upstream progression loop. */
export const RUNE_LIBRARY: readonly RuneDefinition[] = [
  { id: 'attack_chain', skill: 'attack', glyph: '⌁', name: '连锁余火', maxRank: 3, description: (rank) => `火矢命中后跳跃至附近 ${rank} 个目标。` },
  { id: 'attack_burst', skill: 'attack', glyph: '✹', name: '破片火种', maxRank: 3, description: (rank) => `火矢命中产生 ${1.25 + rank * 0.25} 米爆炸。` },
  { id: 'attack_haste', skill: 'attack', glyph: '»', name: '炽热连发', maxRank: 3, description: (rank) => `火矢攻击间隔缩短 ${rank * 12}%。` },
  { id: 'nova_echo', skill: 'nova', glyph: '◎', name: '余震回响', maxRank: 3, description: (rank) => `震环后追加一次 ${36 + rank * 12}% 威力的回响。` },
  { id: 'nova_vortex', skill: 'nova', glyph: '◉', name: '熔心引力', maxRank: 3, description: (rank) => `震环将 ${7 + rank} 米内敌人拉向中心。` },
  { id: 'nova_overload', skill: 'nova', glyph: '✺', name: '过载震波', maxRank: 3, description: (rank) => `震环伤害提高 ${rank * 18}%，范围扩大。` },
  { id: 'dash_blast', skill: 'dash', glyph: '◇', name: '裂隙爆点', maxRank: 3, description: (rank) => `裂隙步落点爆炸，造成 ${55 + rank * 20}% 术强伤害。` },
  { id: 'dash_phase', skill: 'dash', glyph: '↯', name: '相位折返', maxRank: 3, description: (rank) => `裂隙步冷却缩短 ${(rank * 0.55).toFixed(2)} 秒。` },
  { id: 'dash_guard', skill: 'dash', glyph: '⬡', name: '迁跃护壳', maxRank: 3, description: (rank) => `裂隙步落地获得最大生命 ${rank * 7}% 的护盾。` },
  { id: 'ward_heal', skill: 'ward', glyph: '✦', name: '复苏铜纹', maxRank: 3, description: (rank) => `结界完成时恢复最大生命 ${rank * 7}%。` },
  { id: 'ward_thorns', skill: 'ward', glyph: '♢', name: '反噬棘面', maxRank: 3, description: (rank) => `护盾吸收伤害时反射 ${35 + rank * 15}% 术强伤害。` },
  { id: 'ward_pulse', skill: 'ward', glyph: '◌', name: '守御脉冲', maxRank: 3, description: (rank) => `结界展开时对 4 米内敌人造成 ${45 + rank * 20}% 术强伤害。` },
]

/**
 * Creates three deterministic, distinct choices from the currently available runes.
 *
 * @param seed - Stable encounter seed used to vary the draft without global randomness.
 * @param ranks - Current rune ranks; maxed runes are omitted.
 * @returns {RuneDefinition[]} Up to three selectable rune definitions.
 * @sideEffects None.
 */
export function createRuneDraft(seed: number, ranks: RuneRanks): RuneDefinition[] {
  const available = RUNE_LIBRARY.filter((rune) => (ranks[rune.id] ?? 0) < rune.maxRank)
  if (available.length <= 3) return [...available]
  const start = Math.abs(Math.floor(seed)) % available.length
  return [0, 1, 2].map((offset) => available[(start + offset) % available.length])
}

/**
 * Increments one rune rank while preserving the library cap and unknown-id safety.
 *
 * @param ranks - Existing immutable rune rank map.
 * @param runeId - Definition id selected by the traveler.
 * @returns {RuneRanks} New rank map with the selected rune advanced when valid.
 * @sideEffects None.
 */
export function applyRuneChoice(ranks: RuneRanks, runeId: string): RuneRanks {
  const definition = RUNE_LIBRARY.find((rune) => rune.id === runeId)
  if (!definition) return { ...ranks }
  const nextRank = Math.min(definition.maxRank, (ranks[runeId] ?? 0) + 1)
  return { ...ranks, [runeId]: nextRank }
}

/**
 * Converts a skill-family rune build into a multiplicative damage modifier.
 *
 * @param skill - Skill family whose damage is being calculated.
 * @param ranks - Current rune rank map.
 * @returns {number} Damage multiplier, at least one.
 * @sideEffects None.
 */
export function runeDamageMultiplier(skill: RuneSkill, ranks: RuneRanks): number {
  const overload = ranks.nova_overload ?? 0
  const burst = ranks.attack_burst ?? 0
  if (skill === 'attack') return 1 + burst * 0.16
  if (skill === 'nova') return 1 + overload * 0.18
  return 1
}

/**
 * Returns the numeric payload for a rune's runtime behavior.
 *
 * @param ranks - Current rune rank map.
 * @param runeId - Rune id whose effect should be read.
 * @returns {number} Effect value in the id-specific unit, or zero for unknown ids.
 * @sideEffects None.
 */
export function runeEffect(ranks: RuneRanks, runeId: string): number {
  const rank = Math.max(0, Math.min(3, ranks[runeId] ?? 0))
  if (runeId === 'attack_chain') return rank
  if (runeId === 'attack_haste') return rank * 0.12
  if (runeId === 'nova_echo') return rank === 0 ? 0 : 0.36 + rank * 0.12
  if (runeId === 'nova_vortex') return rank
  if (runeId === 'nova_overload') return rank * 0.45
  if (runeId === 'dash_blast') return rank === 0 ? 0 : 0.55 + rank * 0.2
  if (runeId === 'dash_phase') return rank * 0.55
  if (runeId === 'dash_guard') return rank * 7
  if (runeId === 'ward_heal') return rank * 7
  if (runeId === 'ward_thorns') return rank === 0 ? 0 : 0.35 + rank * 0.15
  if (runeId === 'ward_pulse') return rank === 0 ? 0 : 0.45 + rank * 0.2
  return 0
}
